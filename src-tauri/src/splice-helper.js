(function () {
  if (window.__spliceHelperReady) return;
  window.__spliceHelperReady = true;

  var GRAPHQL_URL = "https://surfaces-graphql.splice.com/graphql";

  // Tauri reliably injects __TAURI_INTERNALS__ into capability-granted remote
  // pages, but the high-level window.__TAURI__ global may not be present. Prefer
  // the global when available; otherwise build a minimal emit/listen on top of
  // the internals (the same commands the high-level API uses).
  function getEventApi() {
    if (window.__TAURI__ && window.__TAURI__.event) {
      return window.__TAURI__.event;
    }
    var internals = window.__TAURI_INTERNALS__;
    if (!internals || !internals.invoke || !internals.transformCallback) {
      return null;
    }
    return {
      emit: function (event, payload) {
        return internals.invoke("plugin:event|emit", { event: event, payload: payload });
      },
      listen: function (event, handler) {
        return internals.invoke("plugin:event|listen", {
          event: event,
          target: { kind: "Any" },
          handler: internals.transformCallback(handler)
        });
      }
    };
  }

  function start() {
    var event = getEventApi();
    if (!event) { setTimeout(start, 100); return; }

    // The main window retransmits until the helper is ready. A slow request
    // must not turn each retransmission into another concurrent GraphQL fetch.
    var requests = new Map();
    event.listen("splice-search", async function (msg) {
      var id = msg.payload.id;
      var body = msg.payload.body;
      if (requests.has(id)) {
        var previous = requests.get(id);
        if (previous) event.emit("splice-result", previous);
        return;
      }
      requests.set(id, null);
      function reply(payload) {
        requests.set(id, payload);
        if (requests.size > 64) {
          for (var entry of requests) {
            if (entry[1] !== null) { requests.delete(entry[0]); break; }
          }
        }
        event.emit("splice-result", payload);
      }
      var lastErr = null;

      // Cloudflare clearance can take a moment after the page loads, so retry
      // a few times before giving up.
      for (var attempt = 0; attempt < 4; attempt++) {
        try {
          var resp = await fetch(GRAPHQL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body
          });
          var text = await resp.text();
          if (resp.ok) {
            reply({ id: id, ok: true, body: text });
            return;
          }
          lastErr = "Splice returned HTTP " + resp.status;
        } catch (e) {
          lastErr = String(e);
        }
        await new Promise(function (r) { setTimeout(r, 700); });
      }

      reply({ id: id, ok: false, error: lastErr || "unknown error" });
    });
  }

  start();
})();
