# Device Reality: Android Phones in India (2026) and Local-Notification Reliability for an Expo/React Native Medication Reminder

> Research conducted 2026-10-22. Android OS behaviours are tied to API level and are stable; India market-share and pricing figures are quarterly snapshots and will drift. Every figure below is dated inline.

---

## Q1. Android version distribution, device specs (RAM/storage), and dominant OEMs in India (2026)

### Takeaway
As of mid-2026, roughly half of Indian Android web traffic is on Android 15 or 16, but a long tail of ~18% still sits on Android 11/12 and a further ~26% on Android 13/14 — so an app must handle every exact-alarm regime from pre-12 through 16 simultaneously. The OEM mix is dominated by Chinese skins: vivo (FuntouchOS/OriginOS), Oppo (ColorOS), Xiaomi (HyperOS/MIUI) and realme (realme UI) together take roughly 60%+ of shipments, with Samsung (One UI) the only non-Chinese volume player at 16-17%.

### Cited Findings
- **Android version share, India, August 2026 (mobile, Statcounter):** Android 16 = 24.11%, Android 15 = 23.28%, Android 13 = 13.85%, Android 14 = 12.14%, Android 12 = 9.41%, Android 11 = 8.81% — [Statcounter Android version market share, India](https://gs.statcounter.com/android-version-market-share/mobile/india)
- **July 2026 (mobile+tablet):** Android 15 = 23.6%, Android 16 = 23.46%, Android 13 = 14.02%, Android 14 = 12.42% — [Statcounter](https://gs.statcounter.com/android-version-market-share/mobile-tablet/india)
- **June 2026 (mobile+tablet):** Android 15 = 24.02%, Android 16 = 21.74%, Android 13 = 13.93%, Android 14 = 12.53%, Android 12 = 9.65%, Android 11 = 9.14% — [Statcounter](https://gs.statcounter.com/android-version-market-share/mobile-tablet/india)
- *Caveat:* Statcounter measures web-browsing traffic, not installed base. It systematically under-weights very cheap/low-use devices. Treat as directional.
- **Q1 2026 OEM share (Omdia):** total 30.9m units, -5% YoY. vivo 6.3m / 20%; Samsung 5.1m / 16%; OPPO (excl. realme, OnePlus) 4.7m / 15%; Xiaomi 3.8m; Apple 2.9m — [TelecomLead, Q1 2026](https://telecomlead.com/smart-phone/india-smartphone-market-q1-2026-shipments-fall-5-to-309-mn-as-omdia-flags-demand-pressure-125534)
- **Q1 2026 (IDC):** 31m shipments, -4.1% YoY — [91mobiles / IDC Q1 2026](https://www.91mobiles.com/updates/india-smartphone-market-declined-4-percent-q1-2026-rising-prices-idc/)
- **Q2 2026 OEM share (Omdia):** 33.9m units, -13% YoY. vivo 18%, Samsung 17%, Oppo 14%, Xiaomi 13%, Apple 10% — [TelecomLead, Q2 2026](https://telecomlead.com/smart-phone/top-smartphone-vendors-in-india-vivo-leads-as-omdia-reports-13-shipment-decline-in-q2-2026-126837)
- **Q2 2026 OEM share (Counterpoint — conflicts with Omdia):** market -11% YoY; vivo 20%, Oppo 16%, Samsung 16%, Xiaomi 13% — [Counterpoint India smartphone share](https://www.counterpointresearch.com/india-smartphone-share/)
- **Q3 2026 (Omdia, single source):** 35.8m units, -26% YoY, lowest Q3 volume since 2016; Samsung regained #1 with 6.7m units, first time since Q1 2024 — [t2online](https://t2online.in/tech/tech-news/samsung-tops-india-smartphone-market-as-shipments-fall-26-/2008749)
- **Price bands, Q2 2026 (IDC):** sub-$100 collapsed to ~4.5% of the market (from 15.6% a year earlier), shipments in that band -74.3% YoY. The $100-200 band is the largest at 46.8%. ASP hit a record $315, +14.4% YoY (~₹28,400-30,000) — [91mobiles / IDC Q2 2026](https://www.91mobiles.com/updates/india-smartphone-market-shrinks-11-percent-q2-2026-idc/); [Free Press Journal](https://www.freepressjournal.in/tech/indias-smartphone-shipments-set-to-fall-over-15-in-h2-2026-as-memory-cost-surge-reshapes-the-market)
- **Q1 2026 ASP:** $302, +10.4% YoY; sub-$100 shipments -59% — [91mobiles / IDC](https://www.91mobiles.com/updates/india-smartphone-market-declined-4-percent-q1-2026-rising-prices-idc/)
- **4G feature-grade phones resurgent:** 4G (non-5G) smartphones reached 11.1% of shipments in 2026 as brands revived cheap 4G models under memory-price pressure; IDC expects this to be temporary — [Business Today, Aug 2026](https://www.businesstoday.in/technology/news/story/top-4g-phones-you-can-buy-as-memory-prices-push-up-smartphone-costs-548715-2026-08-15)
- **A global memory (DRAM/NAND) price surge is the dominant 2026 market force**, pushing ASPs up and killing the entry tier; India shipments forecast to fall >15% in H2 2026 — [Free Press Journal](https://www.freepressjournal.in/tech/indias-smartphone-shipments-set-to-fall-over-15-in-h2-2026-as-memory-cost-surge-reshapes-the-market)

### Inferences
- **Target SDK and minSdk:** With ~9% on Android 11 and ~9% on Android 12 as of Aug 2026, a `minSdkVersion` of 24 (Android 7.0, Expo default) or 26 is safe and costs nothing. Dropping below API 26 would mean supporting the pre-notification-channel world; nothing in the Indian distribution requires it.
- **You cannot ship a "modern Android only" alarm strategy.** You need four code paths at once: pre-API-31 (no permission needed), API 31-32 (`SCHEDULE_EXACT_ALARM` auto-granted but user-revocable), API 33 (`USE_EXACT_ALARM` available, `SCHEDULE_EXACT_ALARM` still pre-granted), API 34+ (`SCHEDULE_EXACT_ALARM` denied by default on fresh installs). That is ~68% of the Indian base on API 31+ per Statcounter Aug 2026.
- **The memory-price shock has an unexpected upside for reliability:** the sub-$100 / 2GB-RAM tier is collapsing fast, so the installed base of new devices skews to 4-8GB. But the *existing* installed base — which is what a 2026 app meets — is older and poorer than the shipment mix suggests, because people are holding phones longer as prices rise.
- **Design assumption:** treat vivo + Oppo + Xiaomi + realme (all Chinese skins with aggressive killers) as ~60-65% of your users, and Samsung as ~16%. That means roughly **8 in 10 Indian users are on a skin that dontkillmyapp rates 3💩 or worse** (see Q2).

### Gaps
- **No RAM-tier breakdown found.** None of Counterpoint, IDC or Canalys published an India-specific "share of devices with 2GB / 3GB / 4GB RAM" figure accessible in these searches. The sub-$100 share (4.5% of Q2 2026 *shipments*) is the closest proxy for the 2-3GB tier in new sales, but says nothing about the installed base. Treat "share still on low-RAM devices" as unquantified.
- **No storage-capacity distribution found** for India.
- **No Android Go Edition share figure found** for India in 2026. This matters because Android Go imposes extra background limits, but I could not source its penetration.
- **No HyperOS-vs-MIUI version split** for Xiaomi's Indian base.
- Omdia and Counterpoint disagree materially on Q2 2026 shares (Samsung 17% vs 16%, Oppo 14% vs 16%). Q3 2026 rests on one outlet. Do not cite a single precise share number.

---

## Q2. OEM battery optimisation and app-killing: which skins break scheduled alarms, and the exact settings paths

### Takeaway
This is the single largest reliability risk and it is **not solvable in code** — it requires guiding the user through per-OEM settings screens. dontkillmyapp.com rates Xiaomi, OnePlus and Samsung at the maximum 5💩 aggressiveness, Oppo at 4💩, and vivo, realme and Motorola at 3💩; only AOSP/Pixel and Nokia score 0💩. Samsung's "put unused apps to sleep" rule explicitly kills alarms for apps not opened in ~3 days, which is exactly the usage pattern of a medication reminder.

### Cited Findings — aggressiveness ranking
- **dontkillmyapp.com league table (💩 = aggressiveness, 5 is worst):** Huawei 5 (#1), **Xiaomi 5 (#2)**, OnePlus 5 (#3), **Samsung 5 (#4)**, Meizu 4, Asus 4, **Oppo 4 (#8)**, Lenovo 3, **vivo 3 (#11)**, **realme 3 (#12)**, **Motorola 3 (#13)**, Tecno 3, Sony 2, **AOSP/Pixel/Android One 0**, **Nokia/HMD 0** — [dontkillmyapp.com](https://dontkillmyapp.com/)
- Site's framing: manufacturers "prefer battery life over proper functionality of your apps." Xiaomi's rating carries an exception for its Android One devices; Samsung's is flagged as "especially after Android P update" — [dontkillmyapp.com](https://dontkillmyapp.com/)

### Cited Findings — Xiaomi (MIUI / HyperOS)
Source: [dontkillmyapp.com/xiaomi](https://dontkillmyapp.com/xiaomi). *The page explicitly covers MIUI 10-14 only and does not mention HyperOS; paths on HyperOS 2.x may differ.*
- **Autostart (MIUI 14):** `Settings > Apps > [app] > App permissions > Background autostart`
- **Autostart (older MIUI):** `Security app > Permissions > Auto-start` → enable app
- **Battery saver exception:** `Security > Battery > App Battery Saver > [app] > No restriction`
- **Background power:** `Settings > Additional Settings > Battery & Performance > Manage apps' battery usage` → turn Power Saving Modes off → `Saving Power in the Background > Choose apps > [app] > Background Settings > No restrictions`
- **Per-app battery:** `Settings > Apps > [app] > Battery` → enable "Power-intensive prompt" and "Keep running after screen off"
- **Protected apps:** `Settings > Advanced Settings > Battery Manager > Protected apps` → add app
- **Lock in recents:** drag the app card *downward* in the recents tray to lock it (or long-press → padlock icon). Alternative: `Security > Boost speed > settings cog > Lock apps`. Apps locked here may be spared even by Ultra battery saver.
- **MIUI optimization:** a hidden Developer-settings toggle (enable dev mode by tapping MIUI version 10× in About phone) reported on MIUI 12 to break background tasks.
- The page recommends Android One models over MIUI devices and states background processing "often fails in default settings."

### Cited Findings — Oppo (ColorOS)
Source: [dontkillmyapp.com/oppo](https://dontkillmyapp.com/oppo). *Page is written against an Oppo F1S; labels vary by ColorOS version.*
- **Startup manager:** enable the app in the security app (`com.coloros.safecenter`) startup manager **and** the floating app list
- **ColorOS 6:** `App info > Allow Auto Start-up`
- **Power saver:** `App info > Power Saver` → choose one of three options. If the app is closed, its background services pause and resume only when reopened.
- **Background running:** `App info > Battery usage > Run in background`
- Pin the app in the recents screen
- Running a persistent (foreground-service) notification is listed as the developer-side mitigation

### Cited Findings — vivo (Funtouch OS / OriginOS)
Source: [dontkillmyapp.com/vivo](https://dontkillmyapp.com/vivo). *Page does not mention OriginOS by name.*
- **Autostart (newer):** `Settings > More settings > Applications > Autostart` → enable app
- **Autostart (Funtouch OS ≤2.6):** `i Manager > App manager > Autostart manager`
- **Unrestricted battery (Android 13):** `System settings > [app] > Battery` → set unrestricted
- **Background power:** `Settings > Battery > Background power consumption management` (per app)
- **High background power consumption:** `Settings > Battery > High background power consumption` → enable app
- **Battery optimisation:** long-press app icon `> App Info > Battery > [percentage] > Battery Usage > Battery Optimization` → "Not optimized"
- **Lockdown:** lock the app in the taskbar / Recent Apps

### Cited Findings — realme (realme UI)
Source: [dontkillmyapp.com/realme](https://dontkillmyapp.com/realme)
- **Auto-launch:** `Settings > Battery > Power saving settings > App battery management > [app] > Allow auto-launch`
- **Battery optimisation:** same path → `Optimize battery use`
- **Background activity:** same path → `Allow background activity` (also `Allow foreground activity`)
- **Sleep standby optimisation:** `Settings > Battery > Power saver options > Stand-by optimization > Sleep stand-by optimization` — auto-enables low-power mode when the system believes the user is asleep. **This is a direct threat to night-time dose alarms.**
- **App quick freeze:** stops listed apps from sending/receiving notifications and from running in the background (no settings path documented)
- Power saving mode may terminate background processes; Super power saving mode and Smart Performance Mode disrupt them

### Cited Findings — Samsung (One UI)
Source: [dontkillmyapp.com/samsung](https://dontkillmyapp.com/samsung)
- **THE 3-DAY RULE:** on Pie/Android 10, any app not started in 3 days is put to sleep and background tasks, **including alarms**, stop working. The page reports the period was as short as 3 days on some Android 13 releases too.
- **"Put unused apps to sleep":** disable it. The page warns it can re-sleep apps after ~3 days even after manually waking them, and that the setting **may revert after an OS update or reboot**.
- **Sleeping / Deep sleeping / Never sleeping lists (A11/12, One UI 3/4):** `Settings > Battery > Background usage limits` → verify the app is not in Sleeping or Deep sleeping, and add it to "Never sleeping apps"
- **Per-app battery optimisation:** `Settings > Apps > [app] > Battery > Battery optimization` → switch list to "All apps" → turn off for your app
- **Optimize battery usage (special access):** `Settings > Apps > ⋮ > Special Access > Optimize battery usage` → "All apps" → toggle your app off
- **Adaptive battery:** `Settings > Battery > More battery settings` → disable Adaptive battery
- **Auto-optimize daily / Adaptive power saving:** `Battery > ⋮ > Automation`, or `Device care > ⋮ > Advanced > disable Auto-optimization`
- **Older (Pie/10) alternate layout:** `Device care > Battery > App power management` → disable "Put unused apps to Sleep", remove app from Sleeping/Deep sleeping lists, add to "Apps that won't be put to sleep"
- **Android 13:** several of these options (Optimize battery usage under Special Access, Automation/Advanced under Device Care, Auto-optimize daily, Adaptive power saving) are reported **missing**; per-app battery optimisation, Adaptive battery and the sleeping lists remain.
- **Android 14:** Samsung has stated foreground services for apps targeting Android 14 will work as intended on One UI 6.0+. dontkillmyapp has not confirmed this from user reports.
- Samsung may re-add restricted apps to the kill lists after a firmware update or when it decides an app uses too many resources.

### Inferences
- **Build an OEM-aware onboarding wizard, not a generic "please disable battery optimisation" dialog.** Detect `Build.MANUFACTURER` and deep-link to the specific OEM intent (`miui.intent.action.OP_AUTO_START`, `com.coloros.safecenter/.permission.startup.StartupAppListActivity`, `com.vivo.permissionmanager/.activity.BgStartUpManagerActivity`, etc.), with a screenshot-driven fallback when the activity is absent. The `react-native-device-info` + a manual intent map is enough; there are also community libraries that wrap these intents.
- **Verification is the hard part.** None of these settings are readable by an app — there is no API to ask "am I autostart-enabled on MIUI?". The only honest check is behavioural: fire a silent heartbeat alarm and record whether it landed on time, then surface a "your reminders may not be working" banner if heartbeats are missing. Budget engineering time for this heartbeat/self-diagnostic loop; it is the only way to detect OEM killing in the field.
- **The Samsung 3-day rule is category-fatal if unhandled.** A medication reminder is precisely an app the user never opens — they act on the notification and dismiss it. Every notification must therefore carry an action (e.g. "Taken" / "Snooze") whose handling counts as app activity, and the app should prompt the user to add itself to "Never sleeping apps" during onboarding.
- **realme's "Sleep stand-by optimization" and Xiaomi's background restrictions specifically endanger the night dose** — the 10pm/bedtime slot is the least reliable slot on these phones. If the regimen allows, bias doses toward waking hours and treat the night dose as the one that most needs a `setAlarmClock`-grade alarm.
- Oppo and realme share ColorOS lineage, so the Oppo guidance largely transfers; OnePlus (5💩) also now runs ColorOS-derived OxygenOS.

### Gaps
- **dontkillmyapp's pages are visibly stale relative to 2026 shipping software.** The Xiaomi page stops at MIUI 14 (no HyperOS/HyperOS 2), the Oppo page is written against a 2016 handset, and the vivo page does not cover OriginOS. There is no authoritative 2026-current per-OEM guide; the paths above must be re-verified on real test devices.
- No source found quantifying *how often* alarms are actually dropped per OEM (i.e. no field-measured failure rate). All evidence is qualitative/anecdotal.
- No documentation found on whether MIUI/HyperOS caps the number of notifications an app may post.

---

## Q3. Android 12+ exact alarms, Android 13 POST_NOTIFICATIONS, Android 14/15/16, and Play policy

### Takeaway
A medication reminder **does not qualify for `USE_EXACT_ALARM`** under Google Play policy — that permission is restricted to apps whose *core functionality* is an alarm/timer or a calendar with event notifications, and declaring it without qualifying blocks publication. The correct choice is `SCHEDULE_EXACT_ALARM`, which on Android 14+ is **denied by default on fresh installs**, so the app must explicitly walk the user to the "Alarms & reminders" special-access screen and degrade gracefully when refused.

### Cited Findings — permission strings and API-level behaviour
- Permission strings, declared in `AndroidManifest.xml`:
  `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>` and
  `<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>` — [Android developers: Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Android 12 (API 31):** apps targeting 12+ must declare one of the "Alarms & reminders" permissions or setting an exact alarm throws `SecurityException` — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Android 13 (API 33):** apps targeting 33+ may declare either `SCHEDULE_EXACT_ALARM` or `USE_EXACT_ALARM` — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Comparison table (official):** `USE_EXACT_ALARM` is granted automatically, cannot be revoked by the user, has limited use-case scope, and is subject to Google Play policy. `SCHEDULE_EXACT_ALARM` is granted by the user, can be revoked by user or system, has broader scope, and is **denied by default on fresh installs targeting 13+** — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Android 14 (API 34) change:** `SCHEDULE_EXACT_ALARM` is no longer pre-granted to most newly installed apps targeting Android 13+. Affected app = targets API 33+, declares `SCHEDULE_EXACT_ALARM`, has no exemption, and "**Isn't** a calendar or alarm clock app." Restoring app data via backup to an Android 14 device still leaves the permission denied. An app that already held the permission is pre-granted on OS upgrade to 14 — [Android 14: Changes to exact alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- **Throwing APIs when denied:** `setExact()`, `setExactAndAllowWhileIdle()`, `setAlarmClock()` all throw `SecurityException`. The `OnAlarmListener`-based `setExact` overload does **not** require the permission (but it only works in-process, so it is useless for a reminder that must fire while the app is dead) — [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- **Exemptions always allowed to call setExact:** apps signed with the platform certificate; privileged apps; apps on the power allowlist (requestable via `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`). `SYSTEM_WELLBEING` role holders are pre-granted `SCHEDULE_EXACT_ALARM` — [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- **Request flow:** call `AlarmManager.canScheduleExactAlarms()`; if false, `startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))` with `data = Uri.parse("package:$packageName")`; register a receiver for `AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` and reschedule all alarms on grant (treat it like `ACTION_BOOT_COMPLETED`); re-check in `onResume()` — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule); [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- **When the permission is revoked, the app is stopped and all future exact alarms are cancelled** — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Testing path:** `Settings > Apps > Special app access > Alarms & reminders` — disable it for your app to test the fallback — [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)

### Cited Findings — the three alarm methods, ranked
From least to most time-critical and resource-hungry — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule):
- `setExact()` — nearly precise, "as long as other battery-saving measures aren't in effect"
- `setExactAndAllowWhileIdle()` — nearly precise **even if battery-saving measures are in effect**
- `setAlarmClock()` — precise; the system never adjusts delivery and leaves low-power modes if necessary; highly visible to the user; warned to significantly affect battery life
- **Doze:** alarms are deferred during Doze and wait until the device exits Doze. `setAndAllowWhileIdle()` is the inexact escape hatch. Exact alarms are **not** subject to foreground-service launch restrictions, because Android treats them as critical, time-sensitive interruptions — [Android developers](https://developer.android.com/develop/background-work/services/alarms/schedule)
- **Documented alternatives if exact timing is not required:** `WorkManager` (15-minute minimum flex interval), `setWindow()` (10-minute minimum window), `setAndAllowWhileIdle()`, `set()` — [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)

### Cited Findings — Google Play policy on USE_EXACT_ALARM
From [Google Play: Permissions and APIs that Access Sensitive Information](https://support.google.com/googleplay/android-developer/answer/9888170):
- "`USE_EXACT_ALARM` is a restricted permission and apps must only declare this permission if their core functionality supports the need for an exact alarm"
- Listed acceptable examples: **an alarm or timer app**, and **a calendar app that shows event notifications**
- "Don't use this permission for non-critical features that do not directly contribute to the app's main purpose."
- Apps "that do not meet the acceptable use case criteria will be disallowed from publishing on Google Play."
- For uses outside those cases, the policy directs developers to `SCHEDULE_EXACT_ALARM`: "It provides the same functionality but access must be granted by the user."
- Android's own docs restate the publication block: "Apps will not be able to publish a version of their app with this permission in the manifest unless they qualify based on the policy language" — [Android 14 changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)

### Cited Findings — Android 13 POST_NOTIFICATIONS, and Android 15/16
- Expo's docs describe the Android 13 notification opt-in prompt as OS-shown, and note it **does not appear until at least one notification channel exists** — so create the channel before requesting — [expo-notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- **Android 15 (API 35) foreground-service changes:** `dataSync` foreground services get **6 hours of runtime per 24-hour period**; after that `Service.onTimeout()` is called and the service has a few seconds to `stopSelf()` or the system throws an internal exception; the service is no longer considered a foreground service after `onTimeout()`. The same applies to the new `mediaProcessing` type. Android 15 also restricts starting foreground services from `BOOT_COMPLETED` receivers and while the app holds `SYSTEM_ALERT_WINDOW` — [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-15)
- **Android 16 (API 36):** changes split into target-SDK-gated and all-apps groups. Target-gated: edge-to-edge opt-out removed (`windowOptOutEdgeToEdgeEnforcement` deprecated and disabled); `scheduleAtFixedRate` now executes at most one missed execution immediately on return to a valid lifecycle. All-apps: **JobScheduler runtime quotas adjusted by app standby bucket**, with active buckets getting a generous quota — [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16); [Android 16 changes for all apps](https://developer.android.com/about/versions/16/behavior-changes-all)
- *Unverified:* a third-party blog claims apps targeting Android 16 that use full-screen intents (alarm, call, delivery-tracking apps) must explicitly request `USE_FULL_SCREEN_INTENT`. **I could not confirm this in the official Android 16 pages returned by search.** Treat as a to-verify item — [stora.sh blog](https://stora.sh/blog/2026-04-14-android-api-36-august-deadline-what-to-do-now)
- **No per-app AlarmManager cap is officially documented.** A `dumpsys alarm` walkthrough reports an observed device setting `max_alarms_per_uid = 500`; an AOSP commit titled "Stop crashing the system on hitting the alarm limit" says callers "should guard against any spammy requests that lead them to create a lot of alarms," implying the limit is enforced — [Debugging Alarms with ADB](https://proandroiddev.com/debugging-alarms-with-adb-c8de7096b506); [AOSP commit](https://android.googlesource.com/platform/frameworks/base/+/909251a2caf1)

### Inferences
- **Use `SCHEDULE_EXACT_ALARM`, not `USE_EXACT_ALARM`.** A medication reminder's core functionality is medication adherence, not "alarm clock" or "calendar". Play's wording lists only alarm/timer and calendar apps. Declaring `USE_EXACT_ALARM` risks a publication block — a far worse outcome than a one-time permission prompt. (Counter-argument worth noting to the decision-maker: a reviewer *could* read a reminder app as a "timer app", and some medication apps do ship `USE_EXACT_ALARM`. But the policy says "core functionality", and the Android 14 doc's affected-app criterion is literally "Isn't a calendar or alarm clock app" — the risk is asymmetric. If you want `USE_EXACT_ALARM`, get a Play policy pre-review rather than guessing.)
- **The Android 14+ default-denied behaviour means the permission prompt belongs in onboarding, not at first dose-save.** `canScheduleExactAlarms()` returning false must be a loud, blocking state in the UI — an unarmed reminder app that looks armed is actively dangerous for a patient.
- **Use `setAlarmClock()` for doses, not `setExactAndAllowWhileIdle()`.** `setAlarmClock` is the only tier the docs say the system never adjusts and will leave low-power modes for. The battery cost is real but a handful of alarms a day is negligible, and it also surfaces the next-alarm icon in the status bar, which doubles as user-visible proof the reminder is armed. `setExactAndAllowWhileIdle()` is the fallback if `setAlarmClock`'s UI intrusion is unacceptable.
- **The 500-alarms-per-UID observation is the real Android analogue of iOS's 64-notification cap** (see Q4), and it is roughly 8× more generous — but it is undocumented and OEM-variable, so engineer to a self-imposed ceiling.
- **Do not rely on foreground services as the reminder mechanism.** Android 15's `BOOT_COMPLETED` FGS restriction plus Android 16's standby-bucket JobScheduler quotas mean the FGS route is getting tighter each release, while the exact-alarm route is explicitly exempted from FGS launch restrictions. Exact alarms are the sanctioned path.
- **Reschedule on at least four triggers:** `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`, and `TIMEZONE_CHANGED` / `TIME_SET`. Missing the timezone one is a classic India bug for travelling patients, though India has a single timezone domestically.

### Gaps
- Could not retrieve an official Android page that enumerates Android 15 or Android 16 *exact-alarm* changes specifically. The absence of such a page in results suggests nothing material changed for exact alarms in 15/16, but that is an inference, not a confirmed fact.
- The `USE_FULL_SCREEN_INTENT` requirement for Android 16 is unverified (see above). Full-screen intents matter if you want an alarm-clock-style full-screen dose prompt.
- No official statement found on whether Google Play has ever rejected a medication-reminder app specifically for `USE_EXACT_ALARM`.
- The `max_alarms_per_uid = 500` figure is from a single secondary source reading a device dumpsys; not an API guarantee.

---

## Q4. What expo-notifications supports and does not support on Android

### Takeaway
expo-notifications handles the mechanics (channels, exact-alarm permission helpers, `RECEIVE_BOOT_COMPLETED` auto-added to the manifest) but is explicitly silent on OEM killing, and the Android trigger model is coarser than iOS's calendar matching. There is no documented cap equivalent to iOS's 64 pending notifications, but reliability complaints about delayed/missing Android local notifications are a long-running theme on Expo's own forums.

### Cited Findings
From [expo-notifications documentation](https://docs.expo.dev/versions/latest/sdk/notifications/):
- **Trigger types:** time-interval (both platforms, repeatable); one-off date (`DateTriggerInput`, both); **daily and monthly** (both); **weekly and yearly are Android-only** (iOS achieves the same via calendar triggers); **calendar-matching triggers are iOS-only** — Android must use daily/weekly/monthly/yearly.
- **`delivery` option** on daily/monthly triggers defaults to `'bestEffort'`. `'alarmClock'` requires an exact-alarm permission. **Without an exact-alarm permission, scheduled notifications arrive at an approximate time and `'alarmClock'` silently falls back to `'bestEffort'`.**
- **Permissions:** `SCHEDULE_EXACT_ALARM` must be declared in `AndroidManifest.xml` for exact-time triggers on API 31+; the docs state "Android 14 (API level 34) and later deny it by default for newly installed apps." Helpers: `getExactAlarmPermissionsAsync()` / `requestExactAlarmPermissionsAsync()`. The request **rejects if the app does not declare the permission**, and **if the user revokes it the request promise may never resolve** — so re-check on next launch rather than awaiting it.
- **`USE_EXACT_ALARM`:** the docs note alarm/timer/calendar apps may declare it on API 33+ instead, and that "Google Play restricts it to those categories."
- **`RECEIVE_BOOT_COMPLETED`** is added to the manifest **automatically by the library**, and is used "to set up scheduled notifications when the device (re)starts."
- **Channels:** on Android 8.0+ "all notifications must be assigned to a channel"; if none is set the library creates a fallback channel named **Miscellaneous**. After creation, only a channel's name and description can be changed — importance and sound are immutable. Custom sounds must be configured on the *channel* on 8.0+ (and on the notification content for older versions); the docs recommend setting both. Pass `channelId` on the trigger.
- **Expo Go:** local notifications still work in Expo Go; **Android push notifications are not available in Expo Go from SDK 53 onward**.
- **No maximum number of scheduled notifications is stated** anywhere in the documentation.
- **Battery optimisation / OEM killing: not mentioned at all.** The only adjacent note is that Doze mode can stop the OS delivering notifications to background tasks — and that passage is about background tasks, not scheduled local notifications.

Community/forum evidence (anecdotal, treat accordingly):
- A developer on SDK 44 reported scheduled local notifications sometimes never appearing and sometimes arriving much later — "not at 15:00 but at 16:40 when the smartphone is used again" — [Expo forums: Reliable local notifications](https://forums.expo.dev/t/reliable-local-notifications/63427)
- An Expo staff reply to a thread about schedules being lost after reboot said this is the default behaviour on Android, and suggested server-side push instead of local scheduling — [Expo forums: Scheduled local notifications not triggered after reboot](https://forums.expo.dev/t/scheduled-local-notifications-are-not-triggered-after-phone-reboot/17627). **Note this conflicts with the current docs**, which say the library auto-adds `RECEIVE_BOOT_COMPLETED` to restore schedules on restart; the forum thread is older than the current behaviour.

### Inferences
- **The iOS 64-notification cap has no documented Android equivalent in expo-notifications**, but Android's observed `max_alarms_per_uid` (~500, see Q3) is the practical ceiling, and every expo scheduled notification consumes an alarm slot. For a patient on 5 medicines × 3 doses/day, 500 slots ≈ 33 days of pre-scheduling. **Recommend capping at a 14-30 day rolling horizon and re-topping-up on every app open and on every notification action**, rather than scheduling a year of doses.
- **Android's lack of a calendar-matching trigger is a real design constraint for complex regimens.** "Every Monday, Wednesday, Friday at 8am" needs three separate weekly triggers on Android. "Alternate days" or "every 3 days" cannot be expressed by any native trigger at all and must be materialised as a rolling list of one-off `DateTriggerInput` notifications — which is exactly the pattern that burns alarm slots. Plan the data model around a rolling-window scheduler from day one.
- **Set `delivery: 'alarmClock'` and treat the silent fallback to `'bestEffort'` as a failure state to surface.** The most dangerous behaviour in the whole stack is that a missing permission does not throw — it just makes reminders approximate.
- **Channel immutability is a trap:** importance and sound are fixed at creation. Create a dedicated high-importance channel (e.g. `medication-reminders`) with the right sound/vibration from the first release; getting it wrong means shipping a *new* channel ID later and migrating users, with the old channel lingering in their settings.
- **Create the channel before requesting notification permission on Android 13+**, or the OS prompt will not appear — a sequencing bug that is easy to ship and silently halves your reminder delivery.
- **Expo Go is not a valid test environment for this app.** Build a development build (EAS) from the start; exact-alarm permission behaviour, channels and OEM killing can only be exercised on a real signed build on real Indian-market hardware.

### Gaps
- No official Expo statement found on a maximum number of pending scheduled notifications on Android.
- No official Expo documentation or GitHub issue found (within budget) that addresses OEM battery-killer behaviour — Expo appears to simply not cover it, pushing the problem entirely onto the app developer.
- Could not verify whether the current expo-notifications reboot restoration works reliably on MIUI/ColorOS, where `BOOT_COMPLETED` receivers are themselves commonly suppressed until the user opens the app once.
- The second half of the expo-notifications docs page (characters 100000-123389) was not read; there may be additional Android caveats there.

---

## Q5. Data cost and connectivity in India — how much offline capability matters

### Takeaway
Mobile data is extraordinarily cheap in India (average realised revenue ~₹8/GB in FY26) and consumption is high (~25.5 GB/subscriber/month), so **raw data cost is not a meaningful barrier** — but a medication reminder must still be fully offline-capable because reminder *reliability* cannot depend on connectivity, not because bytes are expensive.

### Cited Findings
- **TRAI Yearly Performance Indicators, FY2025-26:** average revenue realisation per GB of wireless data fell 10.59% to **₹8.02/GB**, from ₹8.97 — [TelecomTalk, TRAI FY26](https://telecomtalk.info/revenue-per-gb-data-drops-fy26-trai/1012551/)
- **Average monthly data usage per subscriber rose to 25.51 GB in March 2026**, up from 21.53 GB a year earlier — [TelecomTalk](https://telecomtalk.info/revenue-per-gb-data-drops-fy26-trai/1012551/); [Times of Oman / TRAI](https://timesofoman.com/article/177687-wireless-data-use-jumps-25-in-fy26-data-revenue-falls-11-per-gb-trai)
- **Wireless data use jumped 25% in FY26 while data revenue per GB fell 11%** — [Times of Oman](https://timesofoman.com/article/177687-wireless-data-use-jumps-25-in-fy26-data-revenue-falls-11-per-gb-trai)
- **Minister's statement, 8 October 2026:** Communications Minister Jyotiraditya Scindia said the cost of 1 GB of mobile data has fallen from ₹268 in 2014 to ₹8 — [TelecomTalk, IMC 2026](https://telecomtalk.info/imc2026-cost-of-1gb-of-data-scindia/1012649/)
- *Caveat flagged by the sources:* ₹8/GB is an **average revenue realisation**, not a retail pack price. It is what operators earn per GB consumed, which is lower than the headline price of a small pack.
- **4G phones were 11.1% of 2026 shipments** as brands revived cheap 4G models under memory-cost pressure — [Business Today](https://www.businesstoday.in/technology/news/story/top-4g-phones-you-can-buy-as-memory-prices-push-up-smartphone-costs-548715-2026-08-15)

### Inferences
- **Do not architect around server-push for reminders.** Expo staff's own forum advice ("use server-side push instead of local scheduling") is the wrong trade for this app in India: FCM delivery is itself throttled by Doze and by the same OEM killers, and adds a hard network dependency to a safety-relevant function. Local alarms are correct; use push only for non-critical nudges (refill reminders, doctor messages).
- **The real connectivity design constraint is intermittency, not cost.** Sync must be an optimistic, offline-first write log that reconciles later — a patient logging "taken" in a basement, a rural clinic, or on a ₹99 pack with exhausted high-speed quota must never lose the entry or see an error.
- Data cost is cheap enough that sync payload size is a non-issue; **storage** on the device and **app size** (Q6) are the binding resource constraints, not bandwidth.

### Gaps
- **No current TRAI or operator figure found for the retail price of a typical entry-level data pack** (e.g. the ₹199/₹299 monthly recharge), nor for daily-quota structures. The ₹8/GB figure should not be presented as what a user pays.
- **No 2026 4G/5G coverage or population-penetration figures found** (rural vs urban 5G availability, 4G coverage percentage). TRAI publishes these but they did not surface in these searches.
- No data found on the share of Indian smartphone users on daily-quota prepaid packs (where high-speed data is throttled after ~1.5-2 GB/day), which is the structure that actually governs perceived connectivity.

---

## Q6. App size sensitivity in India and a reasonable target

### Takeaway
Google's own Play analysis found install-conversion falls measurably as APK size rises, and the effect is larger in emerging markets — roughly 1% conversion per 6 MB globally and around 2-2.5% per 6-10 MB in markets like India. The data is from 2017-2018 and directional, but the direction is unambiguous: keep the Android App Bundle delivery size small.

### Cited Findings
- **Google Play's analysis found a negative correlation between APK size and install conversion rate for apps under 100 MB**, with the widely cited rule of thumb of about **1 percentage point of conversion lost per 6 MB** — [Google Play Dev: Shrinking APKs, growing installs](https://medium.com/googleplaydev/shrinking-apks-growing-installs-5d3fcba23ce2)
- The same work **reported an even larger impact on conversion rates for users in emerging markets**; secondary coverage puts it at roughly **2-2.5% per 6-10 MB**, with one source citing ~2.5% install-conversion gain per 10 MB removed in markets like India and Brazil — [Google Play Dev](https://medium.com/googleplaydev/shrinking-apks-growing-installs-5d3fcba23ce2)
- Cited drivers: limited device storage, data cost of the download, and failed downloads on slow networks. One analysis reports ~70% of people considered app size before installing, due to data and storage concerns in emerging markets — [Google Play Dev](https://medium.com/googleplaydev/shrinking-apks-growing-installs-5d3fcba23ce2)
- **Android App Bundles** are the main lever cited, reducing delivered APK size by roughly 15-20%; Play's size-limit change reduced download size for apps with native libraries by ~8% and installed size by ~16% on average — [Google Play Dev](https://medium.com/googleplaydev/shrinking-apks-growing-installs-5d3fcba23ce2)
- *Caveat flagged by the sources:* most of this data is from 2017-2018, the per-MB sensitivity varies between sources, and the figures should be treated as directional and validated against your own store-listing funnel.

### Inferences
- **Target under ~25 MB delivered download for a React Native/Expo build; treat 40 MB as a ceiling.** A bare Expo managed build with Hermes typically lands in the 25-45 MB range per-ABI; the levers are: ship an **AAB** (not a universal APK) so Play serves per-ABI/per-density slices, enable **Hermes** (default in modern Expo), enable **R8/ProGuard** minification and resource shrinking in release, strip unused locales, and audit the dependency tree for anything pulling in large native libs (icon font packs, moment/locale data, Lottie, large image assets).
- **Avoid `expo-updates`/OTA bundles ballooning on-device storage** if targeting storage-constrained devices — each retained update is another copy of the JS bundle.
- At ₹8/GB the download *cost* is trivial; the size penalty in India is driven by **device storage pressure and download failures on weak networks**, which argues for small size plus resumable-download friendliness (i.e. AAB/Play delivery rather than a sideloaded monolith).

### Gaps
- **No 2024-2026 refresh of the APK-size/conversion data was found.** The Google analysis predates Android App Bundles becoming mandatory and predates the current storage profile of Indian devices. The 1%-per-6-MB figure should be labelled as a 2017-era benchmark.
- No India-specific figure found for typical free storage on a mid-range device.
- No source found specifically measuring React Native/Expo app sizes versus native in Indian install funnels.

---

## Q7. Distribution: Google Play, sideloading, alternatives, and health-app publishing requirements

### Takeaway
Google Play is the only practical channel, and a medication app must complete the **Health apps declaration form** in Play Console (Policy > App content > Health Apps) — a form **every** developer must now submit, including those with no health features — plus maintain a publicly accessible, non-geofenced privacy policy linked both in Play Console and inside the app.

### Cited Findings
- **Health apps declaration is universal:** "Even developers with apps that do not offer any health features must complete this form." It applies to apps on closed testing, open testing and production tracks. "System services and private apps do not need to complete the Health apps declaration." — [Play Console Help: Provide information for the Health apps declaration form](https://support.google.com/googleplay/android-developer/answer/14738291)
- **Where to file:** "Open Play Console and go to the App content page (Policy > App content). Under 'Health Apps,' click Start." Drafts can be saved via "Save as draft." — [Play Console Help](https://support.google.com/googleplay/android-developer/answer/14738291)
- **You must declare all health features offered**; some answers trigger a second page of questions with expandable sections that must each be completed — [Play Console Help](https://support.google.com/googleplay/android-developer/answer/14738291)
- **Privacy policy requirement:** "Health and medical apps must complete the Health apps declaration form in Play Console and post a privacy policy detailing the handling of personal and sensitive data." The privacy policy must be at an **active, publicly accessible, non-geofenced URL (no PDFs)**, and must be provided **both in the Play Console field and within the app itself** — [Play Console Help](https://support.google.com/googleplay/android-developer/answer/14738291)
- **Health Connect:** developers must re-file the Health apps form "if your app has a new data type requirement, or if your app no longer supports a data type", and must "Only request permissions and access data types that support the specific, user-facing health features you offer. Don't request broader access than necessary." — [Publish your health app on Google Play](https://developer.android.com/health-and-fitness/health-connect/publish)
- **Restricted permissions generally:** the Permissions and APIs that Access Sensitive Information policy governs restricted permissions including `USE_EXACT_ALARM`, and apps failing the acceptable-use criteria "will be disallowed from publishing on Google Play" — [Play policy](https://support.google.com/googleplay/android-developer/answer/9888170)

### Inferences
- **Permission inventory to plan for the Data Safety form and the health declaration:** `SCHEDULE_EXACT_ALARM` (restricted-ish, user-granted), `POST_NOTIFICATIONS` (runtime, API 33+), `RECEIVE_BOOT_COMPLETED` (auto-added by expo-notifications), and — only if you add OEM deep-linking helpers or reliability fallbacks — `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (itself a restricted permission under the same Play policy and a common rejection cause; prefer the Settings deep-link over the direct request dialog). Medication names and adherence logs are health data under the Data Safety taxonomy and must be declared; if they never leave the device, declaring "no data collected/shared" dramatically simplifies review.
- **Keep data on-device if at all possible.** A purely local medication reminder with no backend avoids most of the Data Safety and health-declaration surface, avoids India's DPDP Act consent machinery, and removes the push dependency. Add sync only when the product requires it, and then as an explicit opt-in.
- **Sideloaded APK is a bad primary channel but a useful secondary one** for clinic-led distribution: it bypasses Play policy review entirely, but loses auto-update, loses Play-delivered per-ABI size optimisation, and triggers Play Protect warnings. If a hospital partner wants direct distribution, prefer a Play **closed/internal testing track** or **Play's app-sharing link** over a raw APK.
- **OEM app stores (GetApps on Xiaomi, App Market on Oppo/realme, V-Appstore on vivo, Galaxy Store on Samsung) reach exactly the users whose phones kill your alarms** and are worth a secondary listing, but each has its own review and none removes the need for Play.

### Gaps
- **No India-specific Play requirement found** (e.g. a CDSCO/medical-device registration, an Indian health-data certification, or a DPDP Act-specific Play Console field). The searches surfaced only Google's global health-app policy. If the app makes any clinical claim or stores identifiable health records, India's DPDP Act 2023 and any CDSCO software-as-a-medical-device classification should be checked separately — this was outside the scope of what I could source here.
- **Could not retrieve the exact list of questions on the Health apps declaration form** (it is behind Play Console).
- **No 2026 figures found** on Google Play's share of Indian Android app installs versus OEM stores or sideloading, nor on the Indian government's proposed alternative app-store initiatives.
- No source found confirming whether Google Play treats "medication reminder" as a category requiring the stricter health-apps sub-declarations (e.g. the ones for telemedicine or clinical decision support).

---

## Cross-cutting engineering checklist (synthesis — derived from the findings above, not a separate sourced claim)

1. `minSdk` 24+; `targetSdk` 36 (Android 16) to stay Play-compliant.
2. Declare `SCHEDULE_EXACT_ALARM` (not `USE_EXACT_ALARM`). Gate onboarding on `canScheduleExactAlarms()`; deep-link to `Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`.
3. Create a dedicated high-importance notification channel **before** requesting `POST_NOTIFICATIONS` on API 33+. Lock the channel's sound/importance in release 1 — they are immutable after creation.
4. Schedule with `delivery: 'alarmClock'`; detect and loudly surface the silent fallback to `'bestEffort'`.
5. Rolling 14-30 day scheduling horizon, topped up on app open and on every notification action. Do not pre-schedule a year (alarm-slot ceiling ~500/UID, undocumented).
6. Reschedule on `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`, `TIME_SET`/`TIMEZONE_CHANGED`.
7. Per-OEM onboarding wizard keyed on `Build.MANUFACTURER`, with the exact paths in Q2 and screenshots. Re-prompt after OS updates (Samsung settings revert).
8. Notification actions ("Taken" / "Snooze") that count as app activity, to defeat Samsung's 3-day sleep rule.
9. A silent heartbeat alarm + delivery log, surfaced as an in-app "reminders are/aren't working" health indicator — the only way to detect OEM killing in the field.
10. Fully offline-first data layer; push for nudges only, never for the dose reminder itself.
11. Ship an AAB with Hermes + R8; target <25 MB delivered.
12. Test on real MIUI/HyperOS, ColorOS, Funtouch/OriginOS, realme UI and One UI hardware with a development build — Expo Go will not reproduce any of this.
