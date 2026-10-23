# Vernacular, Low-Literacy and Older-Adult UI Patterns for an Indian Medication App

> Scope note for the report writer: research was conducted 2026-10-22. Several of the key questions
> (time-format preference, Indic rendering metrics on low-end Android, published CoWIN UX evaluations)
> returned **no reliable primary sources**. Those are flagged explicitly in the Gaps sections rather
> than filled with plausible-sounding numbers. Where a figure comes from a marketing blog, portfolio
> case study or forecast, that is stated.

---

## Q1. Language distribution on Indian smartphones — English-comfortable vs vernacular-first, and which languages matter most by user count

### Takeaway
Indic-language use is effectively universal among Indian internet users (IAMAI/Kantar put it at ~870 million users, 98% of the base, in 2024), but the reliable *per-language internet-user* breakdown is almost a decade old — the widely cited KPMG-Google numbers are 2016 actuals with 2021 forecasts. For planning purposes, Hindi is roughly 38–40% of Indian-language internet users, with Marathi, Bengali, Tamil, Telugu, Kannada and Malayalam forming the next tier at 3–9% each.

### Cited Findings
- 870 million internet users (98% of all Indian internet users) accessed the internet in Indic languages in 2024; 57% of urban internet users say they *prefer* accessing content in Indic languages — [IAMAI/Kantar, Internet in India 2024](https://www.iamai.in/sites/default/files/research/Kantar_%20IAMAI%20report_2024_.pdf) (figures as surfaced in search; the PDF itself is image-based and did not yield a machine-readable text layer on fetch — see Gaps)
- A separate 2024 IAMAI/Nielsen figure of 68% native-language preference circulates in marketing material but could **not** be verified against the original study — [startupmentors.in blog](https://startupmentors.in/blog/the-underestimated-impact-of-vernacular-marketing-in-reaching-indian-consumers/) (low-quality secondary source; flag as unverified)
- KPMG-Google baseline: ~234 million Indian-language internet users vs 175 million English users at end-2016; projected 536 million Indian-language users by 2021 — [Dazeinfo summary of KPMG-Google](https://dazeinfo.com/2017/05/26/indian-language-users-base/)
- Projected language mix within Indian-language internet users (KPMG-Google forecast): Hindi ~201 million (~38%), Marathi 9%, Bengali 8%, Tamil 6%, Telugu 6%, Kannada 5%, Malayalam 3% — [Dazeinfo summary of KPMG-Google](https://dazeinfo.com/2017/05/26/indian-language-users-base/)
- KPMG-Google 2016 actuals by language: Hindi 254 million, Marathi 64 million, Bengali 53 million, Tamil 40 million Indian-language internet users — [Dazeinfo summary of KPMG-Google](https://dazeinfo.com/2017/05/26/indian-language-users-base/)
- Google's own framing: 9 of every 10 new internet users in India are Indian-language users — [Google, via mahesh.com](https://www.mahesh.com/indian-languages/9-of-the-10-new-internet-users-today-are-indian-language-users-google)
- 2011 Census first-language speaker counts (the correct denominator for *potential* reach, not current internet use): Hindi 528M, Bengali 97.2M, Marathi 83.0M, Telugu 81M, Tamil 69.0M, Gujarati 55M, Urdu 50.8M, Kannada 43.7M, Odia 37.5M, Malayalam 34.8M, Punjabi 33.1M — [Multilingualism in India, 2011 Census data](https://en.wikipedia.org/wiki/Multilingualism_in_India)
- Social-media and SEO-blog figures circulating as "2025/2026 language user counts" (e.g. Hindi ~540 million) are rounded restatements of census *speaker* counts, not internet-user data — noted as such in search synthesis of [Indian Tech & Infra on X](https://x.com/IndianTechGuide/status/1942230094883262563?lang=en)

### Inferences
- A medication app shipping a fixed number of languages should sequence them Hindi → Marathi + Bengali → Tamil + Telugu → Gujarati + Kannada → Malayalam + Punjabi + Odia. That ordering holds under both the 2016 KPMG internet-user mix and the 2011 census speaker counts, so it is robust to the data being stale.
- "98% accessed the internet in an Indic language" is a *usage* statistic, not a *literacy* statistic. It does not mean 98% can read that language's script fluently. Script-reading ability and language-preference are separate variables and must be designed for separately (see Q5).
- The English-comfortable segment is the minority but is not negligible and is concentrated among younger, higher-education users — exactly the segment most likely to be the *caregiver* rather than the patient in a medication app. A two-audience design (elderly vernacular patient + younger English/bilingual caregiver) is implied by the data rather than a single-language choice.

### Gaps
- **No current (2024–2026) per-language internet-user breakdown was found.** Every per-language number located is either a 2016 actual, a 2021 forecast, or a census speaker count. The IAMAI/Kantar 2024 PDF is the most likely source of a current breakdown, but it is published as scanned page images and a direct fetch returned only binary/compressed streams, no extractable text. Obtaining it would require OCR of the PDF.
- No data found on the **script-reading ability** of Indic-language internet users (i.e. what share of people who prefer Hindi content can actually read Devanagari fluently vs rely on voice/video). This is the single most decision-relevant missing number for this project.
- No data found specifically on *smartphone system-language* settings in India (how many users have actually set their phone to a non-English locale), as opposed to content-consumption preference.

---

## Q2. Indic script rendering on low-end Android — font coverage, text expansion, line-height for matras

### Takeaway
This question is **poorly served by published research**; almost everything found is developer anecdote rather than measurement. The defensible findings are: Android ships Noto fonts but lags upstream Noto versions; short UI strings are where expansion bites hardest (100–200% for labels under ~10 characters, settling to ~30% for paragraphs); and Android line-height behaviour is known to diverge from design-tool specs. No source measured Devanagari matra clipping on Android specifically.

### Cited Findings
- Android uses Noto but "only rarely uses the latest versions"; the AOSP copy of Noto Sans Devanagari Regular is listed at version 2.004 (2022 release), so Android's coverage lags upstream Noto — [shkspr.mobi, "Is Android Unicode Yet?"](https://shkspr.mobi/blog/2024/10/is-android-unicode-yet/) (single-author blog, not an audited measurement)
- Noto's stated purpose is to eliminate "tofu" (the placeholder box shown when a device lacks a glyph); Google ships **unhinted** Noto builds for Android and Mac, hinted builds for Windows and Linux — [Google Open Source Blog, "An open source font system for everyone"](https://opensource.googleblog.com/2016/10/an-open-source-font-system-for-everyone.html)
- Text expansion is a function of string length, not just language: labels of ten characters or fewer commonly grow 100–200%, while full paragraphs settle around 30% — [edzlms, "eLearning in Hindi, Tamil & Telugu: What Breaks"](https://edzlms.com/indian-language-elearning-hindi-tamil-telugu/)
- The same source explicitly warns that reliable per-language expansion figures for Hindi, Tamil and Telugu are hard to find, and that "anyone quoting you a precise percentage for Tamil is likely extrapolating" — [edzlms](https://edzlms.com/indian-language-elearning-hindi-tamil-telugu/)
- Published Hindi expansion figures **conflict**: one cheat-sheet gives Hindi as +25%/−15% (i.e. can expand *or* contract); another source says Hindi may *contract* by 10–15% — [LocaleProof text expansion cheat sheet](https://localeproof.com/blog/text-expansion-by-language/); conflicting direction noted in [GTE Localize](https://gtelocalize.net/expansion-contraction-translation/)
- General design margin guidance: plan ~30–40% extra room, or ~35–50% extra width for short UI strings — [POEditor, text expansion and contraction in localization](https://poeditor.com/blog/text-expansion-and-contraction-localization/)
- Android line-height is a known fidelity problem: in Jetpack Compose the line-height setting "is only considered for texts with more than one line", and Android's rendered height runs slightly taller than Figma's — [dev.to, Android and Figma typography](https://dev.to/canyudev/android-and-figma-typography-and-how-to-achieve-100-fidelity-l40)
- React Native line-height on Android diverges from iOS and is fixed by adjusting the font's `hhea` ascender metric — [Medium, consistent font line-height rendering](https://martinadamko.medium.com/consistent-font-line-height-rendering-42068cc2957d); a related RN issue reports inconsistent line spacing with Noto fonts on Android, affecting the first line in particular, while native Android is fine — [facebook/react-native issue #29232](https://github.com/facebook/react-native/issues/29232)
- A Qt forum report describes Noto Devanagari rendering as always bold on Android while Latin renders normally — [Qt forum](https://forum.qt.io/topic/81436/fonts-always-bold-in-devanagari-under-android) (weight, not line-height; single report)
- Devanagari shaping on Android goes through HarfBuzz, which returns glyph IDs plus x/y offsets for Skia to draw — [HarfBuzz, Wikipedia](https://en.wikipedia.org/wiki/HarfBuzz)

### Inferences
- Because the only load-bearing expansion rule found is *length-dependent* (short strings expand most), the implementable guidance for a medication app is: **never fix the width of a short label**. Button labels, chip labels, tab labels, dose-timing labels and medicine-name badges are exactly the 10-characters-or-fewer case that expands 100–200%. Design these as wrapping or auto-sizing containers from the start, not as fixed-width pills.
- The combination of (a) Android applying line-height only on multi-line text in Compose, (b) RN first-line spacing bugs with Noto, and (c) Devanagari's tall matra/shirorekha stack above and below the baseline, means **single-line Devanagari headings are the highest-risk clipping case**. A concrete mitigation is to set `includeFontPadding = true` (or not disable it) for Indic text and verify with a string containing both an upper matra and a lower conjunct, e.g. "दवाई की पर्ची" / "कृपया" / "हृदय".
- Shipping the app's own bundled Noto Sans Devanagari/Tamil/Bengali etc. (rather than relying on the device's system font) removes the Android-version-lag risk identified above. This is a known cost in APK size and is the standard trade-off; for 10 scripts, use per-language font download or Google Fonts downloadable-fonts rather than bundling all.
- Pseudolocalization against the app's own strings is the only way to get a real expansion number. Every source consulted independently arrived at "measure your own strings".

### Gaps
- **No source measured Devanagari matra clipping or required line-height ratios on Android.** No study, no vendor guidance, no AOSP issue surfaced. This is an unanswered question and should be treated as an empirical test the team must run, not a researched fact.
- No source confirmed whether low-end/Go-edition Android devices ship a **trimmed font set** or omit specific Indic scripts. The question of "does a ₹6,000 phone render Odia?" remains open.
- No reliable per-language text-expansion percentage for any Indian language was found; the two Hindi figures located contradict each other on direction.
- No data on Indic **font rendering performance** (shaping cost) on low-RAM devices.

---

## Q3. Numerals — Devanagari vs Western Arabic digits in practice

### Takeaway
Indian-language interfaces overwhelmingly use Western Arabic digits (0–9) in practice; Devanagari digits (०–९) are a minority convention retained in some official and publishing contexts. Platform defaults already reflect this — `Intl` with `hi-IN` produces Western digits unless you explicitly opt into Devanagari — so the safe implementable default is Western Arabic digits everywhere, including inside Hindi strings.

### Cited Findings
- Platform default: a developer found that both Arabic and Hindi locales formatted numbers with Western Arabic digits by default; getting Devanagari required explicitly appending the numbering-system extension, i.e. `hi-IN-u-nu-deva` — [willcodefor.beer, using Intl with Hindi and Arabic numbers](https://willcodefor.beer/posts/intlu) (~5 years old)
- The majority of urban speakers of Devanagari-script languages prefer Arabic numerals when writing the language; Hindi Wikipedia uses both simultaneously, while other Indic Wikipedias follow their own script's numerals — [Wikimedia Meta, Numerals in Indic Languages](https://meta.wikimedia.org/wiki/CIS-A2K/Indic_Languages/Numerals_in_Indic_Languages_&_Indic_language_Wikipedias)
- Arabic digits are in common use throughout India; Devanagari digits still appear in some device interfaces when Hindi is set as the primary language — [Transparent Language Hindi blog, The Evolution of Hindi Numerals](https://blogs.transparent.com/hindi/the-evolution-of-hindi-numerals/)
- The Constitution of India provides for the use of Arabic numerals alongside Devanagari number symbols — [Britannica, Devanagari](https://www.britannica.com/topic/Devanagari)
- Claim that Indian Railways, Delhi Metro and some book publishers follow Devanagari numerals — [Wikimedia Meta](https://meta.wikimedia.org/wiki/CIS-A2K/Indic_Languages/Numerals_in_Indic_Languages_&_Indic_language_Wikipedias) (could not be verified against a current primary source)
- Implementation pitfall: digit-set support is inconsistent per language in real systems — Hindi Wikipedia's `formatnum` returned plain Western digits where Persian produced its own digit set — [Wikimedia Phabricator T155888](https://phabricator.wikimedia.org/T155888)

### Inferences
- For a medication app the decision is effectively settled: **use Western Arabic digits (0–9) for doses, times, dates, pill counts and quantities in every language**. Three independent reasons compound — platform default behaviour, urban-speaker preference, and the fact that pharmaceutical strip packaging in India (the thing the user is holding) prints strengths in Western digits ("500 mg", "5 mg").
- Mixing numeral systems between the app and the physical strip would directly undermine the strongest identification cue low-literacy users have (see Q9). This is a stronger argument for Western digits in this domain than in a general-purpose app.
- Numerals should *not* be a user-facing setting. Adding a toggle for something ~95% of users will never change is exactly the kind of option that confuses the target user.

### Gaps
- No usability study found that tested Devanagari vs Western digits with low-literacy Indian users. The evidence above is convention and platform behaviour, not measured comprehension.
- No data on **numeracy** levels specifically (i.e. whether users who cannot read text can still read 2-digit Western numerals). Medhi-Thies-adjacent work notes most users in one rural self-help-group study "had numeric literacy" (see Q5), which is suggestive but not a measurement.

---

## Q4. Time format — 12-hour vs 24-hour, spoken time, and morning/afternoon/night labelling

### Takeaway
**This question returned no credible sources.** Everyday Indian usage is 12-hour with AM/PM and official/transport usage is 24-hour, but the only sources found for this were SEO content farms and a Hindi-learning blog. Separately, there *is* real evidence (from Thailand, not India) that sun/moon time-of-day pictograms are preferred and understood by low-literacy patients for dosing times — which is the more actionable finding for a medication app.

### Cited Findings
- Everyday Indian usage described as "the standard 12-hour clock format (AM/PM)" — [erp.blackboxoperations.com](https://erp.blackboxoperations.com/blog/india-time-today-am-or) (**low-quality source; treat as unverified**)
- A Hindi-language learning blog states "we use 12 hour system which means we use AM and PM" — [Transparent Language Hindi blog](https://blogs.transparent.com/hindi/?p=3395) (**pedagogical blog, not research**)
- Sources conflict on 24-hour usage: one says 24-hour is "used officially for many purposes", another that it is used alongside AM/PM and "becoming increasingly popular", tying it to railways — [catalog.thelandmarkproject.com](https://catalog.thelandmarkproject.com/read/qRv/186/doc_QUTBnF_IndiaTimeIn24HourFormat) (**generic content page; not reliable**)
- Software detail: Windows 11's English (India) regional format renders 12-hour times with a leading zero, e.g. "02:30 PM" — [Microsoft Q&A thread](https://learn.microsoft.com/en-us/answers/a/12771007) (user report, not Microsoft documentation)
- **Time-of-day pictograms (the usable finding):** a Thai study with low-literacy participants brainstormed symbols for dosing times and found participants preferred the sun and the moon over stars or light/dark; sunrise, noon, sunset and night images each marked a different time of day, and the authors concluded "the sun and the moon seemed appropriate to remind low literates about time of taking medicine" — [Indian Journal of Pharmaceutical Sciences, Development and Evaluation of a Pictogram for Thai Patients with Low Literate Skills](https://www.ijpsonline.com/articles/development-and-evaluation-of-a-pictogram-for-thai-patients-with-low-literate-skills-3590.html)
- The same study's randomized trial found post-intervention understanding scores significantly higher than control, though the development phase used only 21 participants — [IJPS](https://www.ijpsonline.com/articles/development-and-evaluation-of-a-pictogram-for-thai-patients-with-low-literate-skills-3590.html)
- Locally developed pictograms outperform standardized ones: Africans had higher comprehension of locally developed pictures than of standardized pictograms — cited within [Redesigning pictographs for patients with low health literacy](https://scielo.isciii.es/scielo.php?script=sci_arttext&pid=S1885-642X2016000200004)

### Inferences
- The "subah 8 baje" question was not answerable from sources, but the pictogram evidence points to the same implementable answer regardless: **lead with the time-of-day band (sunrise / noon / sunset / night) as the primary, largest visual element, and show the clock time as a secondary line underneath.** This is robust to the unresolved 12-vs-24-hour question because the band carries the meaning and the clock time is the precision detail.
- Given everyday usage is (weakly evidenced as) 12-hour, and the Thai pictogram result, the defensible spec is: 12-hour with a localized AM/PM-equivalent *word* rather than the Latin letters "AM"/"PM" — because "AM"/"PM" is untranslated English abbreviation that a non-English-literate user has no way to decode. Four bands map cleanly onto the standard Indian dosing vocabulary (morning / afternoon / evening / night).
- The "locally developed pictograms beat standardized ones" finding is a direct instruction: **do not ship USP-DI or international pictograms unvalidated.** Pilot the icon set with the actual Indian user group.
- Suppress leading zeros ("8:00", not "08:00") — the Windows India-locale complaint suggests the leading zero reads as wrong even to literate Indian users, and it adds a character of noise for a user decoding digits slowly.

### Gaps
- **No reliable source on Indian 12-hour vs 24-hour preference was found.** Every result was an SEO page or a language blog. A Bureau of Indian Standards document or an Indian Railways timetable convention would be needed to settle it. Do not state a preference as fact in the report.
- No source found on how Indians *speak* times ("subah 8 baje") in a design-research context, and no study of whether spoken-form time labels outperform clock times for medication adherence.
- **No study tested sun/sunrise/moon dosing pictograms with Indian patients specifically.** The supporting evidence is Thai. This should be presented as transferable-but-untested in India.

---

## Q5. Proven patterns for low-literacy users — icon-first, voice, colour, numeric entry, text density

### Takeaway
The HCI4D literature (Medhi/Microsoft Research India and successors) converges on a consistent set: text-free or text-minimal interfaces, audio as a first-class channel rather than an add-on, linear navigation with no scrolling and no deep hierarchy, and a consistent HOME/BACK escape hatch. The most important counter-intuitive finding is that **hand-drawn static representations beat both photographs and conventional icons** for low-literate users — so "use icons" is not automatically correct; icon *style* has to be tested.

### Cited Findings
- Text-free interfaces outperform text-based ones for illiterate and low-literate users; the foundational work combines icons, voice and reduced text — [Medhi et al., Designing mobile interfaces for novice and low-literacy users](https://www.researchgate.net/publication/234829313_Designing_mobile_interfaces_for_novice_and_low-literacy_users)
- A 200-person usability study found **static hand-drawn representations were better understood than photographs or icons** by low-literate users — Medhi et al., as summarised in [Mobile interface design for low-literacy populations](https://www.researchgate.net/publication/254004140_Mobile_interface_design_for_low-literacy_populations)
- In a rural Indian self-help-group study, representational images were most helpful in navigation, even though most of those users had numeric literacy — Medhi et al., via [Medhi & Thies, User Interface Design for Low-literate and Novice Users: Past, Present and Future](https://www.researchgate.net/publication/277620615_User_Interface_Design_for_Low-literate_and_Novice_Users_Past_Present_and_Future)
- Voice guidance for Indian ATM pilots was recommended as **looping voice instructions in simple, slow vernacular** — Medhi et al., via the same review
- Wizard-of-Oz comparison: the graphical interface produced a *higher completion rate*, but users who understood the speech system completed tasks *faster* — Medhi et al., via [Medhi & Thies review](https://www.researchgate.net/publication/277620615_User_Interface_Design_for_Low-literate_and_Novice_Users_Past_Present_and_Future)
- Recurring guidelines across studies: linear navigation; avoid scrolling; avoid complex hierarchies; consistent HOME/BACK pattern for error recovery; avoid Likert scales (too abstract) — [Actionable UI Design Guidelines for Smartphone Applications Inclusive of Low-Literate Users](https://www.researchgate.net/publication/351119416_Actionable_UI_Design_Guidelines_for_Smartphone_Applications_Inclusive_of_Low-Literate_Users)
- Systematic review of UI design for illiterate and semi-literate users, consolidating the above into a research agenda — [Islam, Khan, Inan & Sarker, SAGE Open 2023](https://journals.sagepub.com/doi/10.1177/21582440231172741)
- 2026 work: **FormBharo**, a Hindi voice agent that fills enrollment forms conversationally for low-literacy users in rural India, with a publicly released benchmark — [arXiv preprint](https://arxiv.org/pdf/2608.06027)
- Google Next Billion Users practitioner guidance: use iconography to eliminate the need for language in the UI; "majority of Bharat still communicates in their vernacular languages" — [Designing for Next Billion Users, Google Bangalore talk writeup](https://kumarahir.medium.com/designing-for-next-billion-users-add8b2a1e6a2)
- Emergent smartphone users show a lack of understanding of basic features such as accounts and passwords, alongside sophisticated use of the device for education and skilling — [Sophistication with Limitation: Understanding Smartphone Usage by Emergent Users in India, ACM](https://dl.acm.org/doi/10.1145/3530190.3534824)
- Google NBU: do not assume reliable internet access; Google Station users in Indian railway stations were mostly first-time WiFi users who shared downloaded media offline rather than streaming — [Google Design, Connectivity, Culture, and Credit](https://design.google/library/connectivity-culture-and-credit)
- Google NBU: Tez was built around "people and conversations", borrowing chat-app familiarity rather than financial-app conventions — [Google Design](https://design.google/library/connectivity-culture-and-credit)
- Google NBU process evidence: the Maps two-wheeler prototype "flopped" when tested with riders in Jaipur and had to be redesigned; two-wheelers are 70% of all vehicles registered in India — [Forbes on Google's Next Billion Users](https://www.forbes.com/sites/jilliandonfro/2019/05/15/google-next-billion-users-initiative-maps-two-wheeler-mode/)
- Neighbourly was shaped by street intercept interviews and multiple rounds of iterative usability testing — [Google, How insights from user research help us build for the next billion](https://blog.google/innovation-and-ai/technology/next-billion-users/how-insights-user-research-help-us-build-next-billion-users/)
- Pictographic illustrations reduced dosing errors among low-health-literacy caregivers: 50.4% vs 66.4% error rate for text-only, P < 0.002 — cited in [Chan et al., Journal of Clinical Pharmacy and Therapeutics 2015](https://onlinelibrary.wiley.com/doi/10.1111/jcpt.12272)
- Pictogram misinterpretation was higher in those with lower health literacy; adequate health literacy was associated with superior comprehension — cited in [Pharmaceutical indication pictograms for low literacy viewers](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10623492/)
- 61% of Indian non-pharmacy students could accurately interpret USP-DI pictograms and preferred them to traditional labels — cited in the pictogram review above (population is literate students, so only indirectly relevant)

### Inferences (implementable spec)
- **Screen budget:** one task per screen, linear flow, no scrolling on any primary task screen. "Take today's dose" must be reachable and completable without a single scroll on a 5-inch 720p display.
- **Icon style:** commission **simple hand-drawn-style line illustrations**, not photographs and not Material Symbols, for medicine forms (tablet / capsule / syrup / injection / inhaler / drops) and dosing times. This is the specific, counter-intuitive, well-replicated finding. Then validate comprehension with target users before ship — pictogram comprehension degrades exactly in the low-literacy population, so untested icons are a false sense of safety.
- **Audio is not an accessibility add-on; it is a parallel primary channel.** Every label that carries a dose instruction gets a tap-to-hear audio playback, in slow, simple vernacular, and looping/repeatable. The Wizard-of-Oz result (graphical = higher completion, speech = faster for those who got it) argues for **graphical primary + audio reinforcement**, not voice-only.
- **Error recovery:** a persistent, identically placed HOME control on every screen. Low-literate users recover from getting lost by restarting, not by backtracking.
- **Avoid:** Likert/rating scales, free-text input, abstract settings, password/account concepts, multi-level menus, anything requiring recall rather than recognition.
- **Offline-first is a low-literacy requirement, not just a connectivity one.** The Google Station finding (download and share offline) and the general NBU guidance mean the medication schedule, audio prompts and pictograms must all work with no network.
- **Build the research loop in.** The Maps/Jaipur failure is the strongest single argument in the NBU corpus: a prototype that seems obviously right to the design team failed on contact with the actual user group. Budget for in-home testing with elderly, non-English-reading patients before ship.

### Gaps
- Most foundational Medhi et al. work is 10–15 years old and predates today's smartphone ubiquity; several results were only available via ResearchGate summaries, not full text. Direct access to the primary PDFs was not obtained — the University of Washington course copy of Medhi & Thies 2015 is behind a campus login and returned only an SSO page on fetch.
- No study found that tests these patterns specifically in a **medication-adherence** app in India.
- CGAP design guidance was not located in search results and is not cited here.
- No quantified comparison of hand-drawn vs modern flat-icon styles on a *touchscreen* (the 200-person study predates current UI conventions).

---

## Q6. Case studies — UPI/BHIM, DigiLocker, CoWIN, mDiabetes, ShareChat/Josh

### Takeaway
Published, rigorous UX evaluations of India's flagship digital-public-infrastructure apps essentially **do not exist in the open literature**; almost all available material is designer-portfolio redesigns, which are useful for identifying failure modes but worthless as evidence of what worked. The strongest real evidence in this space is from mDiabetes: automated **voice calls** in rural India produced large, measured awareness gains where SMS-only interventions did not improve clinical outcomes.

### Cited Findings

**mDiabetes (the best-evidenced case)**
- Rural mDiabetes used automated **voice calls twice a week for six months** (56 messages). Belief that diabetes is preventable rose from 25.5% to 69.5%; over 90% recalled prevention messages; significant self-reported lifestyle change in 83% at endline and 73% at follow-up — [Effectiveness of mDiabetes intervention in rural India, PMC11818752](https://pmc.ncbi.nlm.nih.gov/articles/PMC11818752) (pre-post design, no randomized control, self-reported outcomes)
- The earlier **SMS-based** Arogya World program: of 31,725 registrants only 15.6% responded to feedback messages; participants themselves suggested using an **interactive voice response system** for registration and motivation — [MDiabetes initiative using text messages, ResearchGate](https://www.researchgate.net/publication/326503094_MDiabetes_initiative_using_text_messages_to_improve_lifestyle_and_health-seeking_behaviour_in_India)
- Contrasting rigorous evidence: a two-country RCT of prediabetic adults receiving SMS 2–3 times weekly found **no significant reduction in progression to diabetes over 2 years** — [Diabetologia 2019](https://link.springer.com/article/10.1007/s00125-019-05061-y)
- A later AI-enabled mDiabetes quasi-experimental pre-post study exists in rural India — [PMC12717508](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12717508/) (outcome data not retrieved)

**DigiLocker**
- Scale context: by 2023 DigiLocker had over 166 issuers, 160 million users, and had issued 5.6 billion documents — [Harvard case, 9-724-371 (May 2024 revision)](https://ten.nl/wp-content/uploads/2025/05/Harvard-Case.pdf)
- A designer case study identifies language barriers for non-English/non-Hindi speakers and the urban-rural smartphone divide as core problems, recommending simpler navigation and multilingual support — [UX Case Study: DigiLocker, Medium](https://medium.com/@sid.mj30/ux-case-study-digilocker-17af6fdc88f9) (portfolio piece, not an official evaluation)

**BHIM / UPI**
- Repeated designer critiques name the same failure modes: cluttered interface, lengthy onboarding, Scan-and-Pay buried in navigation — [BHIM UPI Redesign case study, Medium](https://medium.com/@k.manan7726/bhim-upi-failing-redesign-case-study-6a69af615fe6)
- A second critique argues the cluttered interface was a significant barrier **especially for elderly and disabled users** — [Beyond the Clutter, Design Bootcamp](https://medium.com/design-bootcamp/beyond-the-clutter-the-inside-story-of-how-i-redesigned-bhim-upi-for-universal-accessibility-and-caa6983aaf2f)
- A rural "BHIM Lite" concept notes rural users often use local languages, have middle-to-low digital savviness, and that many Northeast and BIMARU states have digital literacy below 30% — [UI/UX Case Study: BHIM UPI Lite for rural Indian users, Hashnode](https://ariqnarasaputra.hashnode.dev/uiux-case-study-designing-lite-version-of-bhim-upi-app-for-rural-indian-users)
- BHIM is pursuing vernacular access as a key lever, and UPI Help provides conversational AI support; the argument offered is that low literacy plus linguistic diversity makes **voice-based assistance in local languages** the right lever — [Scroll.in](https://scroll.in/article/1096337/upi-is-a-popular-mode-of-payment-but-it-is-still-limited-by-gender-disparities-and-online-scams)
- A consultancy claims its BHIM redesign contributed to 500M+ users and 10M downloads in 10 days — [NetBramha case study](https://www.netbramha.com/work/bhim-user-experience-design-case-study) (**self-reported vendor figures; not independently verified**)

**CoWIN**
- CoWIN allowed one person to enroll up to five others and choose different vaccination centres for each shot, which helped transient workers and those lacking digital access — [Harvard case, 9-724-371](https://ten.nl/wp-content/uploads/2025/05/Harvard-Case.pdf)
- A government implementation document describes CoWIN as analytics-driven and notes user feedback was critical to improving delivery — [Building Digital Ecosystems for India: An Implementation Blue Book](https://thequantumhub.com/wp-content/uploads/2023/10/ODE-Implementation-Blue-Book-Final-Mar22.pdf)

### Inferences (what transfers to a medication app)
- **The proxy-user pattern is the single most transferable CoWIN design decision.** One digitally-capable person managing up to five other people's records is precisely the shape of Indian medication management: the son or daughter-in-law manages the elderly parent's regimen. Build multi-patient profiles under one account from day one, not as a v2 feature. Note that the pill-colour survey (Q9) found only 10.3% of patients had a caregiver managing medication — so the design must support *both* self-management and proxy management, not assume proxy.
- **Voice calls outperformed SMS in the one well-documented Indian health intervention here.** For adherence reminders this argues for an outbound-voice-call or audio-notification channel rather than text push notifications alone — and crucially, a channel that works on the patient's phone without them opening an app. The 15.6% SMS response rate vs >90% voice message recall is the headline contrast, though the two were measured differently and are not strictly comparable.
- **The recurring BHIM critique is "too many features on the home screen."** For a medication app this means: the home screen is the dose list and nothing else. Every secondary feature (history, refills, reports, settings) moves off the first screen.
- Treat all portfolio redesigns as **hypothesis generators, not evidence**. The report should not present a Medium redesign's claims as validated patterns.

### Gaps
- **No peer-reviewed or NPCI-published evaluation of vernacular or low-literacy UX in UPI/BHIM was found. No published CoWIN UX study was found.** This is a genuine hole in the literature, not a search failure — it was probed from several angles.
- No usable material found on **Jan Aushadhi, Kisan apps, ShareChat or Josh** UX patterns. These were searched for as part of the case-study query and returned nothing of substance. The report should not make claims about them.
- No data on what share of CoWIN registrations actually used the proxy-enrollment feature.

---

## Q7. Accessibility for older adults, and India-specific guidance (GIGW 3.0)

### Takeaway
GIGW 3.0 is the India-specific standard and it is explicitly built on **WCAG 2.1 Level AA**, with 88 mandatory checkpoints of which accessibility is more than half — so the implementable numbers (contrast ratios, target sizes) come from WCAG, with GIGW providing the Indian compliance framing and the Rights of Persons with Disabilities Act 2016 as the legal backdrop. The dominant measured usability barrier for older adults globally is **small font and screen size (76% of studies)**, followed by **menu and navigation issues (63%)**.

### Cited Findings
- GIGW is the authoritative technical and accessibility standard for all Indian government websites and web applications, maintained by NIC under MeitY — [guidelines.india.gov.in, Introduction](https://guidelines.india.gov.in/introduction/)
- GIGW's accessibility success criteria "have been adopted from W3C Web Content Accessibility Guidelines"; secondary sources identify the baseline as WCAG 2.1 AA — [guidelines.india.gov.in, Accessibility: Guidelines and Attributes](https://guidelines.india.gov.in/accessibility-guidelines-and-attributes/)
- GIGW 3.0 structure: 88 mandatory checkpoints across Quality, Accessibility, Cybersecurity and Lifecycle Management, with accessibility accounting for more than half; 17 new guidelines added with references to corresponding WCAG guidelines — [GIGW 3.0 New Features and Roadmap (official PDF)](https://cdnbbsr.s3waas.gov.in/s3c92a10324374fac681719d63979d00fe/uploads/2023/04/2023041074.pdf); full manual at [GIGW 3.0 (official PDF)](https://cdnbbsr.s3waas.gov.in/s3c92a10324374fac681719d63979d00fe/uploads/2025/02/2025021775.pdf)
- GIGW 3.0 extends beyond earlier versions to address **mobile accessibility and cognitive disabilities** — [Skynet Technologies, GIGW 3.0 overview](https://www.skynettechnologies.com/blog/gigw-3-0-government-website-accessibility-in-india) (vendor blog)
- Legal backdrop: the Rights of Persons with Disabilities Act, 2016 — [Wikipedia summary](https://en.wikipedia.org/wiki/Rights_of_Persons_with_Disabilities_Act,_2016)
- Older-adult barrier ranking (systematic review of 53 articles, AHP-prioritized, 15 barriers identified): **small font and screen size is the most critical usability issue at 76%**; menu and navigation issues second at 63%; barriers group into sensory, psychomotor and cognitive limitations — [Awan et al., Scientific Programming 2021](https://onlinelibrary.wiley.com/doi/10.1155/2021/2780257)
- Older users have low spatial abilities, experience confusion and "get lost" navigating smartphone menus — [Awan et al.](https://onlinelibrary.wiley.com/doi/10.1155/2021/2780257)
- India-specific: a study of India's elderly identifies three user profiles — tech-anxious learners, moderately tech-savvy individuals, and community-driven/non-users — and reports difficulties ranging from making calls, sending messages and sharing media to navigating complex app functionality — [Bridging the Digital Gap: Tailoring Smartphone Experiences for India's Elderly, Springer](https://link.springer.com/chapter/10.1007/978-981-96-5503-8_40)
- Indian studies add barriers beyond the global set, including infrastructure and affordability; integration of smartphones into daily life among elderly persons in urban India "remains underexplored" — [Nature Humanities & Social Sciences Communications 2026](https://www.nature.com/articles/s41599-026-07146-7)
- A 2025 systematic review of age-friendly mobile app design exists and is the best consolidated source for design parameters — [Optimizing mobile app design for older adults, PMC12350549](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12350549/)

### Inferences (implementable spec)
- **Anchor compliance to WCAG 2.1 AA** and state GIGW 3.0 conformance. Because GIGW adopts WCAG criteria directly, implementing WCAG 2.1 AA gets you the accessibility half of GIGW's 88 checkpoints. For a non-government app this is a credibility and procurement asset (relevant if the app is ever pitched to a public health programme).
- **Font size is the top priority, by measured evidence.** The 76% finding means type scale is not one accessibility item among many — it is the item. Practical consequence: a base body size well above the typical 14sp Android default, a maximum-size bias throughout, and full support for the OS font-scale setting (do not use `dp` for text, do not cap `fontScale`). Indic scripts compound this because matras are small relative to the base glyph, so the same point size is less legible in Devanagari than in Latin.
- **Navigation is the second priority (63%).** Combined with "older users get lost in menus", this converges with the low-literacy guidance in Q5 on exactly the same answer: flat, linear navigation, consistent HOME, no nested menus.
- The three Indian elderly profiles (tech-anxious / moderately savvy / community-driven non-users) suggest the app must have a **zero-setup path driven by someone else** for the third group — which again points to the CoWIN proxy pattern from Q6.
- Touch-target and contrast specifics should be taken from WCAG 2.1/2.2 and the platform HIGs directly rather than from this research, since no India-specific numbers were found.

### Gaps
- **No India-specific numeric accessibility parameters** (minimum font size in sp, minimum touch target in dp, contrast ratio) were found in GIGW 3.0 secondary coverage. The official 88-checkpoint PDF would need to be read directly to extract any India-specific numbers; search snippets only confirmed the WCAG derivation.
- The 76%/63% barrier figures come from a review of mostly **non-Indian** studies. They should be presented as global findings applied to India, not as Indian data.
- The claim that GIGW requires content in multiple Indian languages appeared only in a vendor blog and **could not be confirmed** against the official text.
- No Indian study found that measures what font size or touch target size elderly Indian users actually need.

---

## Q8. Voice interaction in Indian languages — 2026 state of TTS and STT

### Takeaway
As of 2026 the Indian-language speech stack is substantially better than it was: Bhashini (the government's national language-AI platform) supports 23 Indian voice languages and powers 800+ government sites, and open models from AI4Bharat, IIT Madras and IISc are freely available. But on-device Android TTS/ASR for Indian languages remains the weak link — the production-grade models are cloud models, and the documented failure mode is **noisy real-world audio**, which is exactly the condition in an Indian household.

### Cited Findings
- Bhashini supports 36 Indian text languages, 23 Indian voice languages and 35 international languages; powers more than 800 government websites; over 9 billion cumulative AI inferences, reported at over 24 million inferences daily — [India Speaks Online in 22 Languages with Bhashini, BharatGen, and Adi-Vaani](https://completeaitraining.com/news/india-speaks-online-in-22-languages-with-bhashini-bharatgen/)
- Bhashini's model catalogue lists ASR and TTS models from IIT Madras, IISc and AI4Bharat across many Indian languages (e.g. `bhashini/iitm/asr-indoaryan--gpu--t4` covering Gujarati, Odia, Hindi, Marathi, Punjabi, Bengali) — [Bhashini API model catalogue](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage)
- Government deployment is real and expanding: Madhya Pradesh signed a partnership with the Bhashini Division to integrate multilingual AI across state digital governance platforms; thousands of village councils use the SabhaSaar platform, which transcribes and translates meeting minutes recorded in local languages — [Science.org, India's national AI platform tackles the country's many tongues](https://www.science.org/content/article/india-s-national-ai-platform-tackles-country-s-many-tongues)
- A Bhashini workshop in Maharashtra in September 2026 focused on Marathi multilingual AI for digital services — [APAC News Network, Sept 2026](https://apacnewsnetwork.com/2026/09/bhashini-maharashtra-marathi-ai/)
- Bhashini + IISc Bengaluru released TTS models for Sourashtra, a minority language, as part of expanding speech tech to under-resourced languages — [Tripura Net](https://tripuranet.com/bhashini-and-iisc-bengaluru-develop-text-to.html)
- **Key limitation:** existing ASR models are trained mostly on adult speech in quiet settings and perform poorly in noisy environments or with poor internet; IIT Madras had to specifically harden a model for noisy classroom conditions — [Science.org](https://www.science.org/content/article/india-s-national-ai-platform-tackles-country-s-many-tongues)
- A May 2026 paper argues commercial and open-source Indic ASR still fails on entity-dense audio (which includes names — i.e. **drug names**) and proposes synthetic audio to close the gap — [The TTS-STT Flywheel, arXiv 2605.03073](https://arxiv.org/pdf/2605.03073)
- Android on-device ASR: `SpeechRecognizer.createOnDeviceSpeechRecognizer()` exists from API 31+ and runs locally with no network, but **availability must be checked at runtime** because creation fails on phones without an on-device model. Tested with Hindi-English code-switching, some English words transliterated correctly into Devanagari — [HackerNoon, Oct 2026](https://hackernoon.com/testing-androids-on-device-speech-recognition-with-hindi-english-code-switching)
- Google's Speech Recognition & Synthesis app is the standard Android TTS engine — [Google Play](https://play.google.com/store/apps/details?id=com.google.android.tts&hl=en_IN)
- Open on-device Hindi TTS is immature: Vani TTS is explicitly "under development" with training in progress after an architecture change — [vivek-541/vani-tts, GitHub](https://github.com/vivek-541/vani-tts); VoxSherpa is a fully offline Android neural TTS app on Sherpa-ONNX with Hindi support, updated September 2026 — [hindi-tts GitHub topic](https://github.com/topics/hindi-tts)
- AI4Bharat's IndicF5 is a flow-matching TTS covering 11 Indic languages, but is **not** an on-device Android model — [hindi-tts GitHub topic](https://github.com/topics/hindi-tts)
- A commercial analysis claims AI4Bharat and Bhashini models are "genuinely production-capable" for Tier-1 and several Tier-2 languages — [caller.digital, Open-Source Voice AI India 2026](https://caller.digital/blog/open-source-voice-ai-india-sarvam-ai4bharat-bhasini-2026) (**vendor blog; weigh accordingly**)

### Inferences (implementable spec)
- **TTS (output) is viable now; ASR (input) is the risk.** Three reasons: the ASR noise limitation is documented by a primary source; drug names are the entity-dense case that the 2026 arXiv paper says Indic ASR still fails at; and the Wizard-of-Oz finding from Q5 already said graphical beats speech on completion rate. So: **ship voice output everywhere, ship voice input only as an optional accelerator with a graphical fallback always present.** Never make voice input the only path to any task.
- **Do not depend on on-device ASR.** `createOnDeviceSpeechRecognizer()` must be feature-detected at runtime, and the target device class (cheap Android phones) is precisely where it is most likely absent. Architect for: on-device if available → cloud (Bhashini/AI4Bharat) if online → graphical input always.
- **TTS for dose instructions should be pre-generated, not synthesized live.** The set of spoken strings in a medication app is small and mostly templated ("Take one tablet of X in the morning after food"). Pre-rendering audio for the fixed phrase bank, per language, gives offline operation, consistent quality, and avoids the drug-name pronunciation problem entirely — drug names can be recorded or synthesized once and quality-checked, rather than mispronounced live on every playback. This sidesteps the weakest part of the 2026 stack.
- **Bhashini is a credible national API** for the cloud tier and carries government legitimacy, which matters for a health app. Its model catalogue is public and the per-language coverage can be checked directly against the app's language roadmap from Q1.
- Audio should be slow and simple — the ATM-pilot guidance from Q5 ("looping voice instructions in simple, slow vernacular") still applies and is about delivery style, which no amount of TTS quality improvement changes.

### Gaps
- **No benchmark found comparing on-device Hindi ASR accuracy on Android against cloud systems**, and none assessing Google's current on-device Hindi TTS *quality*. The HackerNoon write-up is a single developer's anecdotal test.
- No word-error-rate figures for any Indic ASR on elderly speech, which is a distinct and harder condition than the adult-speech-in-quiet-settings baseline the Science.org source describes.
- No data on Bhashini API latency, pricing, rate limits or SLA for commercial (non-government) use.
- The one source describing Bhashini as "production-capable" is a vendor blog; no independent benchmark was located.

---

## Q9. How people actually identify their medicines — and what that implies for add/recognise flows

### Takeaway
This is the best-evidenced question in this brief, with a direct India-specific study. **Indian cardiac patients identify medicines primarily by pill colour (29.4%), strip colour (28.4%) and brand name (28.0%) — and the split is strongly driven by education and age.** Among patients with high-school education or below, colour-based identification dominates (36.9% pill colour + 34.4% strip colour = 71%) while only 11.9% use brand names; among college-educated patients it inverts to 62.0% brand name. Nearly 60% of all patients report confusion between similar-looking medicines.

### Cited Findings

All from Rao S, Akhoury S, et al., *Indian Journal of Cardiovascular Disease in Women* 2026;11:80-6, doi:10.25259/IJCDW_17_2025 — a questionnaire survey of **901 Indian cardiovascular patients** across hospitals in Indore, Faridabad, Mumbai, Varanasi, Ahmednagar, Kolkata, Ernakulam, Kanpur and Bhopal — [IJCDW](https://ijcdw.org/survey-on-the-impact-of-pill-color-on-medication-adherence/):

- **Identification method (multiple pills):** pill colour 29.4%; strip colour 28.4%; brand name 28.0%; sticker 5.5%; pill organizer box 4.9%; label 3.6%; other 1.7%. Shape and size were **not** measured.
- **Confusion with look-alike medicines:** 59.3% confused; 31.9% not confused; 8.8% don't know.
- **By education (high school and below, n=609, vs college and above, n=292):** pill colour 36.9% vs 13.9%; strip colour 34.4% vs 15.7%; brand name 11.9% vs 62.0%; knew which drugs treat their heart condition 44.3% vs 73.5% (p<0.001); reported confusion 67.1% vs 42.9% (p<0.001); believed unique colours help 82.4% vs 66.9% (p<0.001).
- **By age (≤50 vs >50):** pill colour 20.9% vs 33.4%; strip colour 24.5% vs 30.1%; brand name 44.8% vs 20.4%; reported confusion 50.5% vs 63.2% (p<0.001).
- **By sex:** women rely more on pill colour (33.1% vs 26.6%) and strip colour (30.7% vs 26.4%); men more on brand name (32.2% vs 22.9%). Men were more likely to know which drugs treat their heart condition (58.8% vs 47.8%, p=0.001).
- **Unique colours:** 77.4% believe unique colours (e.g. golden/special) aid identification, reduce forgetfulness and improve adherence; ~44% currently take a uniquely-coloured medicine (red 9.3%, pink 7.3%, blue 6.0%, yellow 6.0%).
- **Sample characteristics relevant to a medication app:** 39.2% aged over 60; a further 29.4% aged 51–60. Education below high school 42.5%. **Self-managed medication 89.7%; caregiver-managed only 10.3%.** Daily pill burden: 3–4 drugs 44.9%, 5+ drugs 30.5%, 1–2 drugs 24.1%.
- **Author-stated limitations:** sample size may limit generalizability; real-world confounding; the study did **not** measure actual adherence (all self-report) and did **not** test the effect of changing a pill's colour.

Corroborating non-Indian evidence:
- US hypertensive primary-care patients who identified medicines only by visual features (size, shape, colour) rather than by name reported **worse** adherence — [Journal of Health Communication](https://www.tandfonline.com/doi/full/10.1080/10810730.2013.825671)
- A pilot in patients aged 65+ tested colour-specific symbols added to bottle labels to improve matching of medicines to their purpose — [PMC3282670](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3282670/)
- Context: reported medication adherence in India ranges from 18.7% to 74%, and **no validated adherence measurement tool exists for the Indian setting** — [PMC11653035](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11653035/)

### Inferences (implementable spec)
- **The "add a medicine" flow must not start with typing a name.** 71% of lower-education Indian patients do not identify medicines by name at all. A name-first flow is unusable for the target user and is the single clearest design failure this research rules out.
- **Photograph-of-the-strip is the correct primary add mechanism.** Strip colour (28.4%) plus pill colour (29.4%) together account for 58% of identification, and both are captured in one photo of the blister pack. The strip also carries the printed brand name and strength in Western digits, which serves the 28% who do use brand names and gives OCR something to work with. One capture action satisfies every identification strategy in the data.
- **Display the user's own photo as the primary identity of each medicine in the list**, larger than the text name. The patient recognises their strip; they do not recognise "Telmisartan 40 mg". The text name sits below the photo for caregivers and pharmacists.
- **Supplement with an explicit colour attribute, selected from large colour swatches** (not a text field). Red, pink, blue and yellow are the reported unique colours and should be the lead swatches. 77.4% of patients believe colour aids identification; a colour swatch is also a non-textual, non-linguistic input that requires zero literacy.
- **Design explicitly against look-alike confusion — it affects 59.3% of patients and 67.1% of the low-education group.** Concrete behaviour: when two medicines in a user's list have the same user-assigned colour or visually similar photos, surface a distinguishing cue — a user-assigned purpose icon ("for BP", "for sugar", "for heart") with audio, or a user-recorded voice label. The "white tablet for BP" mental model should be first-class: **purpose + colour, not name**, as the recognition key.
- **Let the user record their own audio label for each medicine.** This is a one-tap, zero-literacy, zero-ASR-dependency solution to naming: the patient or their family member says "BP ki safed goli" and that recording plays at reminder time. It bypasses every weakness in the 2026 Indic ASR stack (Q8) because it is recording and playback, not recognition.
- **Plan for 3+ concurrent medicines as the default case, not the edge case** — 75.4% of patients take 3 or more daily. The dose-list screen must handle 5+ items legibly at large font sizes without scrolling being the only answer (group by time-of-day band from Q4).
- **Design for self-management first.** 89.7% manage their own medication; only 10.3% have a caregiver doing it. This tempers the proxy-account inference from Q6: build proxy support, but the primary user of the screen is the elderly patient themselves.
- **Caveat worth surfacing in the report:** the US finding that visual-only identification correlates with *worse* adherence means an app that leans entirely on colour risks reinforcing a weak mental model. The resolution is to use the photo/colour as the *recognition handle* while the app supplies the name, purpose and dose as spoken/pictorial reinforcement — i.e. use the user's existing mental model as the entry point, then add information, rather than replacing their model or capitulating to it.

### Gaps
- The IJCDW study did **not** measure identification by shape or size, so the brief's question about shape is unanswered.
- The study is of **cardiovascular** patients and is geographically skewed (West 42.0%, East 38.1%, North 19.1%, **South 0.9%**). South Indian patterns are effectively unrepresented.
- All outcomes are self-reported; actual adherence was not measured, and the effect of colour change on adherence was not tested.
- **No study found that evaluates pictorial medication labels in Indian patients specifically** — the supporting pictogram evidence is Thai, South African and US.
- No research found on whether Indian patients can successfully photograph their own medicine strips, or on OCR accuracy against Indian pharmaceutical packaging.
