# Rewarded video integration pending provider approval

The AI usage panel opens an inactive preview: extra AI usage, more models, and a 24-hour Caffeine trial after two completed videos. No ad SDK, reward endpoint, subscription changes, or usage grants are enabled. The lock artwork includes reduced-motion support and an unlocked presentation state; that state is not currently activated.

Before activation, obtain the approved provider's rewarded placement and completion-verification specification. Confirm whether Adsterra banners/popunders are permitted on the same property. Do not accept a client-side completion flag as proof of entitlement.

Implement authenticated, expiring reward sessions tied to a user and offer; verify provider completion on the server using the actual documented protocol. Consume each provider event once, transactionally. Two distinct completed videos are required for Caffeine. Skips, failures, no-fill, expired sessions, replayed callbacks, and cross-account claims must grant nothing. Preserve paid subscriptions and independent moderation restrictions. Start the 24-hour trial only after the second verified completion. Set explicit AI allowances/model scope and redemption limits before activation; those quantities are not chosen yet.

The preview text is intentionally member-facing. Never unlock the animation until the server confirms the grant. Tests currently certify the inactive UI only, not a live video provider or reward flow.
