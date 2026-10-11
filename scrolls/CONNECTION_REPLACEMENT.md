# Connection replacement: release blocked

The original implementation is in connection/. It uses parse5, css-tree, Acorn, Undici, ws and tough-cookie. It does not import, copy, wrap or re-export the removed networking engine. Nyx now launches this document service on a separate origin locally. The root dependency purge and fresh lockfile generation are complete.

The application replacement is not complete. The full release signature/native-call audit fails, and remote-site isolation and compatibility work remain. Do not deploy the current output. Production has only the separately released redirect repair and retains its previous engine.

See [the complete verification report](REPLACEMENT_VERIFICATION.md) for raw scan output, failures, changed files, dependency removal and limitations. A passing component test is not a passing whole-application test.

Latest local repair and interaction results: [SEARCH_AND_UI_VERIFICATION.md](SEARCH_AND_UI_VERIFICATION.md). The full release remains blocked.
