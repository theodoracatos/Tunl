# TUNL 17.1 - Play Console / App Store Connect copy (16 locales)

17.1 is the first store release since 16.1: 17.0 was only ever shipped to the web, so the
store "What's New" covers both. 17.0: hangar paint kit, visible streak/stardust, F-14-style
silhouette. 17.1: Greek as the 16th language (settings language grid now 4x4), and a mine
can no longer spawn inside a boulder island (`94af670`, already live on the web since 17.0).

Deliberately NOT in the copy: point values or exact percentages (qualitative only,
feedback_marketing_no_stat_numbers). No em dashes.

Versions: iOS marketing 17.1 / build 58, Android versionName 17.1 / versionCode 52.

**New store locale: Greek** (ASC `el`, Play `el-GR`). Needs, besides What's New below:
the listing fields in the Greek section, the Greek screenshots from
`Screenshots/iOS_15.0/el/` (portrait-6.9in, portrait-6.5in, play-9x16) and the Greek
achievement/leaderboard localizations (`branding/game-center/ach_translations_*.json`, key `el`).

**ASC / Play status**: not yet submitted.

---

## Greek store listing (new locale)

### App name (ASC 30 / Play 30)  (29 chars)
TUNL: Πόσο Μακριά Θα Πετάξεις

### Subtitle (ASC, 30)  (26 chars)
Καθημερινή Πρόκληση Πτήσης

### Keywords (ASC, 100)  (90 chars)
σπηλιά,τούνελ,πτήση,arcade,ένα κουμπί,καθημερινή πρόκληση,κατάταξη,σκάφος,flappy,ατελείωτο

### Short description (Play, 80)  (77 chars)
Κράτα για άνοδο, άφησε για πτώση. Μία σπηλιά τη μέρα, ίδια για όλο τον κόσμο.

### Promotional text / Werbetexte (ASC, 170)  (155 chars)
Μία σπηλιά τη μέρα, η ίδια για κάθε παίκτη στη Γη. Απογειώσου πάνω από την πόλη στο σούρουπο, βούτα στον βράχο: πόσο βαθιά θα φτάσεις πριν χαθεί για πάντα;

Full description: translated from the live en-US listing when the locale is added (the
listings live only in the consoles, see feedback_store_listing_locale_separate).

---

## Promotional Text (Werbetexte, 170-char limit) - UNCHANGED since 15.0, plus el

Leave populated locales as they are; only `el` is new.

### en-US  (159 chars)
One cave a day, the same one for every player on Earth. Take off over the city at dusk, dive into the rock, and see how deep you get before it is gone forever.

### de-DE  (153 chars)
Eine Höhle pro Tag, weltweit für alle dieselbe. Start über der Dämmerungsstadt, hinein in den Fels: Wie tief kommst du, bevor sie für immer verschwindet?

### fr-FR  (161 chars)
Une grotte par jour, la même pour tous. Décolle au-dessus de la ville au crépuscule, plonge dans la roche : jusqu'où iras-tu avant qu'elle disparaisse à jamais ?

### it-IT  (155 chars)
Una grotta al giorno, la stessa per tutti nel mondo. Decolla sopra la città al tramonto, tuffati nella roccia: quanto arrivi prima che sparisca per sempre?

### es-ES  (165 chars)
Una cueva al día, la misma para todo el mundo. Despega sobre la ciudad al anochecer, adéntrate en la roca: ¿hasta dónde llegas antes de que desaparezca para siempre?

### pt-BR  (157 chars)
Uma caverna por dia, a mesma para todos no mundo. Decole sobre a cidade ao entardecer, mergulhe na rocha: até onde você chega antes de ela sumir para sempre?

### ja-JP  (56 chars)
毎日ひとつの洞窟。世界中が同じ洞窟を飛ぶ。夕暮れの街から離陸し、岩へ飛び込め。永遠に消える前にどこまで行けるか。

### ko-KR  (76 chars)
하루에 동굴 하나, 전 세계가 똑같은 곳을 난다. 황혼의 도시에서 이륙해 바위 속으로. 영원히 사라지기 전에 얼마나 깊이 갈 수 있을까?

### zh-TW  (47 chars)
每天一個洞窟，全球玩家飛的都是同一個。從黃昏的城市起飛，衝進岩壁。在它永遠消失前，你能飛多深？

### ru-RU  (141 chars)
Одна пещера в день, одна и та же для всех. Взлетай над городом в сумерках и ныряй в скалу. Как далеко долетишь, пока она не исчезла навсегда?

### ar  (131 chars)
كهف واحد كل يوم، هو نفسه للاعبين في كل العالم. أقلع فوق المدينة عند الغسق وانطلق داخل الصخر. إلى أي مدى تصل قبل أن يختفي إلى الأبد؟

### tr-TR  (154 chars)
Günde bir mağara, dünyadaki herkes için aynısı. Alacakaranlıkta şehrin üzerinden kalk, kayanın içine dal. Sonsuza dek kaybolmadan ne kadar derine inersin?

### id  (159 chars)
Satu gua per hari, sama untuk semua pemain dunia. Lepas landas di atas kota saat senja, menukik ke batu. Sejauh apa kamu bisa sebelum gua itu lenyap selamanya?

### pl-PL  (144 chars)
Jedna jaskinia dziennie, ta sama dla wszystkich. Startuj nad miastem o zmierzchu i nurkuj w skałę. Jak daleko dolecisz, zanim zniknie na zawsze?

### hi-IN  (129 chars)
हर दिन एक गुफा, पूरी दुनिया के लिए वही एक। शाम के शहर से उड़ान भरें, चट्टान में गोता लगाएं। गायब होने से पहले कितनी दूर जाते हैं?

### el  (155 chars)
Μία σπηλιά τη μέρα, η ίδια για κάθε παίκτη στη Γη. Απογειώσου πάνω από την πόλη στο σούρουπο, βούτα στον βράχο: πόσο βαθιά θα φτάσεις πριν χαθεί για πάντα;

---

## What's New / Release Notes (17.1)

### en-US  (342 chars)
Paint your ship: mix hull colour, pattern, material and effect in the new hangar paint kit. Your streak and stardust are finally visible, with an always-on wallet, a path to your next ship and a shard bonus for a full week. Plus a new silhouette: swept F-14 wings. TUNL now speaks Greek, and a mine can no longer hide inside a boulder island.

### de-DE  (382 chars)
Lackiere dein Schiff: Kombiniere Hüllenfarbe, Muster, Material und Effekt im neuen Hangar-Lackierkit. Serie und Sternenstaub sind endlich sichtbar, mit dauerhaftem Wallet, einem Pfad zum nächsten Schiff und einem Shard-Bonus für eine volle Woche. Dazu eine neue Silhouette: gepfeilte F-14-Flügel. TUNL spricht jetzt Griechisch, und keine Mine versteckt sich mehr in einer Felsinsel.

### fr-FR  (431 chars)
Peins ton vaisseau : combine couleur de coque, motif, matière et effet dans le nouveau kit de peinture du hangar. Ta série et ta poussière d'étoiles sont enfin visibles, avec un portefeuille permanent, un chemin vers ton prochain vaisseau et un bonus d'éclats pour une semaine complète. Et une nouvelle silhouette : des ailes en flèche façon F-14. TUNL parle désormais grec, et plus aucune mine ne se cache dans un îlot de rochers.

### it-IT  (433 chars)
Dipingi la tua nave: combina colore dello scafo, motivo, materiale ed effetto nel nuovo kit di verniciatura dell'hangar. La tua serie e la polvere di stelle sono finalmente visibili, con un portafoglio sempre attivo, un percorso verso la prossima nave e un bonus di schegge per una settimana intera. In più una nuova silhouette: ali a freccia stile F-14. TUNL ora parla greco, e nessuna mina si nasconde più dentro un'isola di massi.

### es-ES  (416 chars)
Pinta tu nave: combina color del casco, patrón, material y efecto en el nuevo kit de pintura del hangar. Tu racha y tu polvo estelar por fin son visibles, con una cartera siempre activa, un camino hacia tu próxima nave y una bonificación de fragmentos por una semana completa. Además, una nueva silueta: alas en flecha estilo F-14. TUNL ya habla griego, y ninguna mina vuelve a esconderse dentro de una isla de roca.

### pt-BR  (416 chars)
Pinte sua nave: combine cor do casco, padrão, material e efeito no novo kit de pintura do hangar. Sua sequência e sua poeira estelar finalmente estão visíveis, com uma carteira sempre ativa, um caminho até sua próxima nave e um bônus de fragmentos por uma semana completa. Além disso, uma nova silhueta: asas em flecha estilo F-14. O TUNL agora fala grego, e nenhuma mina se esconde mais dentro de uma ilha de rocha.

### ja-JP  (166 chars)
自分の機体を塗装しよう。新しい塗装キットで船体の色、模様、素材、エフェクトを自由に組み合わせられる。連続記録とスターダストがついに見える化:常時表示のウォレット、次の機体への道のり、1週間続けた時のシャードボーナス。さらに新シルエット、後退翼のF-14型に。TUNLがギリシャ語に対応。岩の島の中に機雷が隠れることもなくなりました。

### ko-KR  (207 chars)
내 기체를 직접 도색하세요. 새로운 격납고 도색 키트로 선체 색상, 패턴, 재질, 이펙트를 조합할 수 있습니다. 연속 기록과 스타더스트가 드디어 눈에 보입니다: 상시 표시되는 지갑, 다음 기체까지의 경로, 일주일을 채우면 받는 샤드 보너스. 여기에 새로운 실루엣, 후퇴익 F-14 날개까지. 이제 TUNL이 그리스어를 지원하고, 바위 섬 안에 지뢰가 숨는 일도 없습니다.

### zh-TW  (120 chars)
為你的機體上漆。全新機庫塗裝套件，自由組合船體顏色、圖案、材質與特效。連續紀錄與星塵終於看得見了:常駐錢包、通往下一艘船的路徑，還有滿一週的碎片獎勵。此外還有全新輪廓:後掠的F-14機翼。TUNL 現在支援希臘文，地雷也不會再藏在巨石島裡。

### ru-RU  (361 chars)
Раскрась свой корабль: сочетай цвет корпуса, узор, материал и эффект в новом наборе покраски ангара. Твоя серия и звёздная пыль наконец видны: постоянный кошелёк, путь к следующему кораблю и бонус осколков за полную неделю. Плюс новый силуэт: стреловидные крылья в стиле F-14. TUNL теперь говорит по-гречески, а мины больше не прячутся внутри каменных островов.

### ar  (328 chars)
لوّن سفينتك: امزج لون البدن والنقش والمادة والتأثير في مجموعة الطلاء الجديدة في الحظيرة. أصبحت سلسلتك وغبار النجوم مرئيين أخيراً، مع محفظة ظاهرة دائماً، ومسار نحو سفينتك التالية، ومكافأة شظايا عن أسبوع كامل. بالإضافة إلى مظهر جديد: أجنحة مائلة على طراز F-14. أصبحت TUNL تتحدث اليونانية، ولم تعد الألغام تختبئ داخل الجزر الصخرية.

### tr-TR  (365 chars)
Geminizi boyayın: yeni hangar boya kitiyle gövde rengini, deseni, malzemeyi ve efekti birleştirin. Serin ve yıldız tozun artık görünür: her zaman açık cüzdan, bir sonraki gemine giden yol ve tam bir hafta için parça bonusu. Ayrıca yeni bir siluet: F-14 tarzı geriye yatık kanatlar. TUNL artık Yunanca konuşuyor ve hiçbir mayın artık kaya adasının içine saklanmıyor.

### id  (354 chars)
Cat kapalmu: gabungkan warna lambung, pola, material, dan efek di kit cat hanggar baru. Streak dan stardust akhirnya terlihat, dengan dompet yang selalu tampil, jalur menuju kapal berikutnya, dan bonus keping untuk satu minggu penuh. Plus siluet baru: sayap sapu gaya F-14. TUNL kini berbahasa Yunani, dan ranjau tak lagi bersembunyi di dalam pulau batu.

### pl-PL  (375 chars)
Pomaluj swój statek: łącz kolor kadłuba, wzór, materiał i efekt w nowym zestawie lakierniczym w hangarze. Twoja seria i pył gwiezdny są wreszcie widoczne, z zawsze widocznym portfelem, ścieżką do następnego statku i bonusem odłamków za pełny tydzień. Do tego nowa sylwetka: skośne skrzydła w stylu F-14. TUNL mówi teraz po grecku, a miny nie chowają się już w wyspach głazów.

### hi-IN  (347 chars)
अपने जहाज़ को रंगो: नए हैंगर पेंट किट में हल का रंग, पैटर्न, मटीरियल और इफ़ेक्ट मिलाओ। तुम्हारी स्ट्रीक और स्टारडस्ट आख़िरकार दिखाई देते हैं, हमेशा दिखने वाले वॉलेट, अगले जहाज़ तक के रास्ते और पूरे हफ़्ते के लिए शार्ड बोनस के साथ। साथ ही एक नई सिल्हूट: F-14 जैसे तिरछे पंख। TUNL अब ग्रीक बोलता है, और अब कोई माइन चट्टान के टापू के अंदर नहीं छिपता।

### el  (379 chars)
Το TUNL μιλάει πλέον ελληνικά! Βάψε το σκάφος σου: συνδύασε χρώμα ατράκτου, σχέδιο, υλικό και εφέ στο νέο κιτ βαφής του υπόστεγου. Το σερί και η αστερόσκονή σου φαίνονται επιτέλους, με πορτοφόλι πάντα ορατό, δρόμο προς το επόμενο σκάφος και μπόνους θραυσμάτων για μια ολόκληρη εβδομάδα. Νέα σιλουέτα: φτερά σε στιλ F-14. Και καμία νάρκη δεν κρύβεται πια μέσα σε νησί από βράχους.
