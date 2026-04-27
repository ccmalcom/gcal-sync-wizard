// ============================================================
// Cross-Calendar Busy Mirror
// Deploy in BOTH accounts. Update CONFIG per account.
// ============================================================

// === CONFIG (set per deployment) ===
const SOURCE_CALENDAR_ID = "chase.malcolm@springhealth.com"; // the read calendar (read from)
const SOURCE_OWNER_EMAIL = "chase.malcolm@springhealth.com"; // owner of the source calendar
const TARGET_CALENDAR_ID = "primary"; // YOUR own calendar (write to)
const MIRROR_PREFIX = "[SH]"; // label on your side, e.g. "[CM] Busy"
const LOOKAHEAD_DAYS = 30;
const TAG_KEY = "busyMirror"; // do NOT change between deploys
const DRY_RUN = false; // flip to false when ready
const COLOR_ID = 4; // flamingo (spring health)
// ===================================

function syncCalendars() {
  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);

  const sourceEvents = fetchSourceEvents_(now, horizon);
  const existingMirrors = fetchExistingMirrors_(now, horizon);
  const targetUIDs = fetchTargetICalUIDs_(now, horizon);  // NEW

  const mirrorsBySourceId = {};
  existingMirrors.forEach(m => {
    const sid = m.extendedProperties?.private?.sourceEventId;
    if (sid) mirrorsBySourceId[sid] = m;
  });

  const seenSourceIds = new Set();
  let created = 0, updated = 0, unchanged = 0, deleted = 0, skippedDup = 0;

  sourceEvents.forEach(src => {
    if (!shouldMirror_(src, targetUIDs)) {  // pass UIDs in
      if (src.iCalUID && targetUIDs.has(src.iCalUID)) skippedDup++;
      return;
    }
    seenSourceIds.add(src.id);

    const existing = mirrorsBySourceId[src.id];
    if (!existing) {
      if (DRY_RUN) console.log(`WOULD CREATE: ${buildMirrorBody_(src).summary} @ ${src.start.dateTime || src.start.date}`);
      else Calendar.Events.insert(buildMirrorBody_(src), TARGET_CALENDAR_ID, { sendUpdates: 'none' });
      created++;
    } else if (mirrorNeedsUpdate_(existing, src)) {
      if (DRY_RUN) console.log(`WOULD UPDATE: ${existing.summary} @ ${existing.start.dateTime || existing.start.date}`);
      else Calendar.Events.update(buildMirrorBody_(src), TARGET_CALENDAR_ID, existing.id, { sendUpdates: 'none' });
      updated++;
    } else {
      unchanged++;
    }
  });

  existingMirrors.forEach(m => {
    const sid = m.extendedProperties.private.sourceEventId;
    if (!seenSourceIds.has(sid)) {
      if (DRY_RUN) console.log(`WOULD DELETE: ${m.summary} @ ${m.start.dateTime || m.start.date}`);
      else Calendar.Events.remove(TARGET_CALENDAR_ID, m.id, { sendUpdates: 'none' });
      deleted++;
    }
  });

  console.log(`Sync: ${created} created, ${updated} updated, ${unchanged} unchanged, ${deleted} deleted, ${skippedDup} skipped (already on target)`);
}

function shouldMirror_(event, targetUIDs) {
  if (event.status === 'cancelled') return false;

  // Loop prevention: never mirror a mirror.
  if (event.extendedProperties?.private?.[TAG_KEY] === 'true') return false;

  // NEW: skip if the same underlying meeting is already on the target calendar
  if (event.iCalUID && targetUIDs.has(event.iCalUID)) return false;

  // Skip events the user marked as "free"
  if (event.transparency === 'transparent') return false;

  // Skip noise types
  if (['workingLocation', 'birthday', 'fromGmail'].includes(event.eventType)) return false;

  // Always mirror OOO and Focus Time — these are explicit personal blocks
  if (event.eventType === 'outOfOffice' || event.eventType === 'focusTime') return true;

  // Default events with attendees: require source owner to have accepted
  if (event.attendees?.length) {
    const owner = event.attendees.find(
      a => a.email?.toLowerCase() === SOURCE_OWNER_EMAIL.toLowerCase()
    );
    if (owner) return owner.responseStatus === 'accepted';
    return event.organizer?.email?.toLowerCase() === SOURCE_OWNER_EMAIL.toLowerCase();
  }

  return true;
}

function buildMirrorBody_(src) {
  let title;
  if (src.eventType === "outOfOffice") title = `${MIRROR_PREFIX} Out of Office`;
  else if (src.eventType === "focusTime") title = `${MIRROR_PREFIX} Focus Time`;
  else title = `${MIRROR_PREFIX} Busy`;

  return {
    summary: title,
    start: src.start,
    end: src.end,
    visibility: "public",
    transparency: "opaque",
    colorId: COLOR_ID,
    reminders: { useDefault: false, overrides: [] }, // critical: no notifications
    extendedProperties: {
      private: {
        [TAG_KEY]: "true",
        sourceEventId: src.id,
        sourceCalendarId: SOURCE_CALENDAR_ID,
      },
    },
  };
}

function mirrorNeedsUpdate_(mirror, src) {
  if ((mirror.start.dateTime || '') !== (src.start.dateTime || '')) return true;
  if ((mirror.start.date || '') !== (src.start.date || '')) return true;
  if ((mirror.end.dateTime || '') !== (src.end.dateTime || '')) return true;
  if ((mirror.end.date || '') !== (src.end.date || '')) return true;
  if (mirror.summary !== buildMirrorBody_(src).summary) return true;
  if ((mirror.colorId || '') !== COLOR_ID) return true;
  return false;
}

function fetchSourceEvents_(timeMin, timeMax) {
  return paginate_((pageToken) =>
    Calendar.Events.list(SOURCE_CALENDAR_ID, {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      pageToken,
    }),
  );
}

function fetchExistingMirrors_(timeMin, timeMax) {
  return paginate_((pageToken) =>
    Calendar.Events.list(TARGET_CALENDAR_ID, {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      privateExtendedProperty: `${TAG_KEY}=true`,
      pageToken,
    }),
  );
}

function paginate_(fetchFn) {
  const out = [];
  let pageToken;
  do {
    const resp = fetchFn(pageToken);
    if (resp.items) out.push(...resp.items);
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return out;
}
function fetchTargetICalUIDs_(timeMin, timeMax) {
  const events = paginate_(pageToken => Calendar.Events.list(TARGET_CALENDAR_ID, {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    showDeleted: false,
    maxResults: 250,
    pageToken
  }));
  const uids = new Set();
  events.forEach(e => {
    // Skip mirrors themselves — we only want "real" events on the target side
    if (e.extendedProperties?.private?.[TAG_KEY] === 'true') return;
    if (e.iCalUID) uids.add(e.iCalUID);
  });
  return uids;
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncCalendars") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncCalendars").timeBased().everyMinutes(15).create();
  console.log("Trigger installed: syncCalendars every 15 minutes");
}

function diagnose() {
  try {
    const cal = Calendar.Calendars.get(SOURCE_CALENDAR_ID);
    console.log('Calendar accessible:', cal.summary, cal.timeZone);
  } catch (e) {
    console.log('Cannot access calendar metadata:', e.message);
    return;
  }

  try {
    const resp = Calendar.Events.list(SOURCE_CALENDAR_ID, {
      timeMin: new Date().toISOString(),
      maxResults: 5,
      singleEvents: true
    });
    console.log('Event list works. Got', resp.items?.length, 'events');
    if (resp.items?.[0]) {
      console.log('Sample event:', JSON.stringify(resp.items[0], null, 2));
    }
  } catch (e) {
    console.log('Event list fails:', e.message);
  }
}

