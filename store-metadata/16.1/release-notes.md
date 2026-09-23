# TUNL 16.1 - Play Console / App Store Connect "What's New" copy (15 locales)

Updated 2026-09-21 after `b0d3fea` landed on top of the original 16.1 prep (still under this
same version string, iOS build bumped 55 -> 56, Android versionCode 49 -> 50): a wall contact
now spends a shield before the hull, so the hull only scratches once nothing shields it. A
repair kit gives back ONE scratch (not a full refill as the original copy below said) and a
scratched hull shows real gouges with drifting smoke, stopping while a shield is up. The death
sound also changed ("Crash" replaces the balloon pop). The crystal-root fix (`_xtalFit`) is
unchanged from the original prep and dropped from the copy to make room - it already shipped
web-side and is a minor item next to the hull/shield rework.

Deliberately NOT in the copy: point values (qualitative only, feedback_marketing_no_stat_numbers)
and pixel/dB numbers. No em dashes.

Promotional text (Werbetexte): UNCHANGED from 15.0/16.0/original-16.1 prep, still the section
below - not touched by this update, only What's New changed.

Versions: iOS marketing 16.1 / build 56, Android versionName 16.1 / versionCode 50.
Store assets: none new.

**ASC status**: What's New PATCHed for all 15 locales via `iris/v1` on the 2b77682b version
(build 56 already attached), re-GET `===` verified 15/15. Submitted for review 2026-09-21.

---

## Promotional Text (Werbetexte, 170-char limit) - unchanged since 15.0 (copy into 16.1)

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

---

## What's New / Release Notes (updated, replaces the original 16.1 copy)

### en-US  (289 chars)
Your hull shows the damage. A wall hit spends a shield first, so only a bare hull scratches, and a scratched hull now shows real gouges with drifting smoke. Destroy a mine or cannon shot with ammo and it drops a wrench: fly through to repair one scratch. Also: a new crash sound on impact.

### de-DE  (382 chars)
Deine Hülle zeigt die Schäden. Ein Wandkontakt kostet zuerst ein Schild, nur eine ungeschützte Hülle bekommt einen Kratzer, und eine verkratzte Hülle zeigt jetzt echte Riefen mit ziehendem Rauch. Zerstörst du eine Mine oder einen Kanonenschuss mit Munition, lässt er einen Schraubenschlüssel fallen: Flieg hindurch, um einen Kratzer zu reparieren. Außerdem: ein neuer Absturz-Sound.

### fr-FR  (331 chars)
Ta coque montre les dégâts. Un contact avec la paroi coûte d'abord un bouclier, seule une coque nue s'éraille, et une coque éraflée affiche désormais de vraies entailles avec de la fumée. Détruis une mine ou un tir de canon avec des munitions et il lâche une clé : traverse-la pour réparer une éraflure. Et un nouveau son de crash.

### it-IT  (346 chars)
Lo scafo mostra i danni. Un contatto con la parete consuma prima uno scudo: solo uno scafo nudo si graffia, e uno scafo graffiato ora mostra solchi veri con fumo che si disperde. Distruggi una mina o un colpo di cannone con le munizioni e lascia cadere una chiave inglese: attraversala per riparare un graffio. In più, un nuovo suono di schianto.

### es-ES  (329 chars)
Tu casco muestra los daños. Un choque con la pared gasta primero un escudo: solo un casco desnudo se raya, y un casco rayado ahora muestra surcos reales con humo a la deriva. Destruye una mina o un disparo de cañón con munición y suelta una llave inglesa: pasa por ella para reparar un rasguño. Además, un nuevo sonido de choque.

### pt-BR  (336 chars)
Seu casco mostra os danos. Um contato com a parede gasta primeiro um escudo: só um casco sem escudo arranha, e um casco arranhado agora mostra marcas reais com fumaça se dissipando. Destrua uma mina ou tiro de canhão com munição e ele solta uma chave inglesa: passe por ela para consertar um arranhão. Além disso, um novo som de batida.

### ja-JP  (121 chars)
船体がダメージを物語る。壁に触れるとまずシールドが消費され、シールドがない船体だけが傷つく。傷ついた船体には実際の傷と漂う煙が表示される。弾薬で機雷や砲弾を破壊するとレンチが落ち、通過すると傷が1つ修理される。さらに新しいクラッシュ音も追加。

### ko-KR  (166 chars)
선체가 손상을 보여줍니다. 벽에 부딪히면 먼저 실드가 소모되고, 실드가 없을 때만 선체에 흠집이 생깁니다. 흠집 난 선체는 이제 실제 패임과 흩날리는 연기를 보여줍니다. 탄약으로 지뢰나 대포알을 파괴하면 렌치가 떨어지고, 통과하면 흠집 하나가 수리됩니다. 또한 새로운 충돌 사운드가 추가되었습니다.

### zh-TW  (92 chars)
船體會顯示損傷。撞牆時先消耗護盾，只有沒有護盾的船體才會刮傷，刮傷的船體現在會顯示真實的凹痕與飄散的煙霧。用彈藥擊毀地雷或砲彈會掉出一把扳手，飛過它可修復一道刮痕。另外新增了撞擊音效。

### ru-RU  (348 chars)
Корпус теперь показывает повреждения. Удар о стену сначала тратит щит: царапина появляется только на незащищённом корпусе, а поцарапанный корпус теперь показывает настоящие вмятины с уносящимся дымом. Уничтожь мину или снаряд пушки боеприпасом, и он уронит гаечный ключ: пролети сквозь него, чтобы залечить одну царапину. Также новый звук крушения.

### ar  (250 chars)
بدنك يظهر الضرر. الاصطدام بالجدار يستهلك الدرع أولاً، فلا يُخدش سوى البدن غير المحمي، والبدن المخدوش يُظهر الآن خدوشاً حقيقية مع دخان متصاعد. دمّر لغماً أو قذيفة مدفع بالذخيرة فيُسقط مفتاح ربط: اطر خلاله لإصلاح خدش واحد. إضافة إلى ذلك، صوت تحطم جديد.

### tr-TR  (313 chars)
Gövden hasarı gösteriyor artık. Duvara temas önce kalkanı harcar, sadece kalkansız gövde çizilir, çizilmiş gövde artık gerçek oyuklar ve savrulan dumanla görünüyor. Cephaneyle bir mayını ya da top atışını yok et, bir İngiliz anahtarı düşsün: içinden geçerek bir çiziği onar. Ayrıca yeni bir çarpışma sesi eklendi.

### id  (390 chars)
Lambungmu kini menunjukkan kerusakan. Menabrak dinding menghabiskan perisai lebih dulu, hanya lambung tanpa perisai yang tergores, dan lambung yang tergores kini menampilkan goresan nyata dengan asap yang melayang. Hancurkan ranjau atau tembakan meriam dengan amunisi dan ia menjatuhkan kunci inggris: terbang melewatinya untuk memperbaiki satu goresan. Selain itu, ada suara tabrakan baru.

### pl-PL  (332 chars)
Twój kadłub pokazuje uszkodzenia. Kontakt ze ścianą zużywa najpierw tarczę, tylko nieosłonięty kadłub się rysuje, a porysowany kadłub pokazuje teraz prawdziwe wgniecenia z unoszącym się dymem. Zniszcz minę lub pocisk armatni amunicją, a upuści klucz: przeleć przez niego, by naprawić jedno zarysowanie. Do tego nowy dźwięk rozbicia.

### hi-IN  (308 chars)
अब तुम्हारा हल नुकसान दिखाता है। दीवार से टकराने पर पहले शील्ड खर्च होती है, बिना शील्ड वाला हल ही खरोंचता है, और खरोंचा हुआ हल अब असली निशान और उड़ते धुएं के साथ दिखता है। गोला-बारूद से किसी माइन या तोप के गोले को नष्ट करो तो वह एक रिंच गिराता है: उसमें से उड़कर एक खरोंच ठीक करो। साथ ही, एक नई क्रैश ध्वनि।
