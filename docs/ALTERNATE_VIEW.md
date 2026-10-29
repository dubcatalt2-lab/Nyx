# Alternate view

The Apps page includes Alternate view at `/apps/r7f29c1/index.html`. The existing engine remains the default.

Vendor source: https://github.com/zaka13alt/uvthing at a090b257525fd88c0037c9c2b8b4334368093f0b. Unmodified vendor files and MIT notice are under assets/vendor/r7f29c1. The upstream launcher is not shipped: it unregisters other service workers.

Nyx owns the launch UI, settings bridge, configuration, and scoped worker. The worker covers only /apps/r7f29c1/; it handles encoded view requests and leaves other requests alone. Existing registrations are preserved. In the Nyx shell the app uses the currently selected relay. Direct launches use runtime configuration or the same-origin /resources/live/ endpoint.

Run source checks:

    node scripts/test-alternate-view.mjs
    node scripts/test-alternate-relay.mjs

The first checks input rejection, worker coexistence and reopening with transport setup mocked. The second uses real vendor code, a real local Wisp relay and an external HTTPS document, over both WebSocket and HTTP relay modes. It does not certify third-party account flows, Discord, YouTube or reCAPTCHA.

Build through the named production builder, then rerun both tests with NYX_TEST_STATIC_ROOT=dist. Never edit dist directly.

The production builder removes vendor source-map references from generated copies; source vendor files stay unchanged.

Standalone static-host launches use the configured backend meta address. The Apps entry uses an explicit index.html so the S3 REST endpoint can resolve it before a worker controls the page.
