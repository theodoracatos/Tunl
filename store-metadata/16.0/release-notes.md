# TUNL 16.0 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: the stalactites and stalagmites had looked the same since version 1.0 - a smooth
bezier cone - while the ship, coins and boulders had all moved to flat facets lit from
above. They are now clusters of upright crystal prisms, with a different mineral per day
of the week (calcite, rust quartz, selenite, obsidian, amethyst, olivine, rhodonite -
not named in the copy, see below). Breaking one now sounds and looks like glass, not
gravel. A falling one leaves its rock socket behind on the ceiling and lands buried
tip-first in the floor instead of flipping over. Hitbox, placement, the daily seed and
every fairness invariant are byte-for-byte unchanged (`CRYSTAL_STALS` in
`src/constants.js` reverts the visual with no other change) - not said explicitly in the
copy either, same "don't explain the internals" rule as 15.0's camera-only aside.

Deliberately NOT in the copy: the seven mineral names (real, but listing all seven in 15
languages risks a wrong or awkward term in one I can't verify well - "a different mineral
for each of the seven daily worlds" carries the idea without the risk), any performance
numbers, and anything about the hitbox being unchanged (a reassurance nobody asked for
reads as an admission something might be wrong). Every locale is comfortably under
Google Play's 500-character limit (see the counts below), so the same copy doubles as
App Store Connect's "Neues in dieser Version". No em dashes.

Promotional text (Werbetexte): UNCHANGED from 15.0/15.1, copied below so it can be
pasted. Nothing about the core pitch (one shared daily cave, dusk launch, hold-to-climb)
changed, so it is not rewritten.

Versions: iOS marketing 16.0 / build 54, Android versionName 16.0 / versionCode 48.
Store assets: none new.

**DECISION (user, 2026-09-21): keep the old screenshots and preview video as they are.**
They still show the smooth-cone stalactites rather than the new crystal clusters. Raised
once as a flag, not a request; the user's call was to leave them - do not re-raise this
on a future release unless the user brings it up.

---

## Promotional Text (Werbetexte, 170-char limit) - unchanged since 15.0

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

## What's New / Release Notes

### en-US  (294 chars)
Stalactites and stalagmites are crystal clusters now, with a different mineral for each of the seven daily worlds. Break one and it shatters into real shards with a glassy crack instead of a rocky thud. A falling stalactite leaves its rock socket behind and lands buried tip-first in the floor.

### de-DE  (305 chars)
Stalaktiten und Stalagmiten sind jetzt Kristallcluster, mit einem eigenen Mineral für jede der sieben Tageswelten. Zerbrichst du einen, splittert er in echte Scherben mit hellem Glasklang statt dumpfem Steinschlag. Ein fallender Stalaktit lässt seinen Felssockel zurück und landet mit der Spitze im Boden.

### fr-FR  (309 chars)
Les stalactites et stalagmites sont désormais des amas de cristaux, avec un minéral propre à chacun des sept mondes du jour. Brise-en une et elle vole en éclats de verre au lieu d'un choc sourd de pierre. Une stalactite qui tombe laisse son socle de roche en place et se plante pointe la première dans le sol.

### it-IT  (318 chars)
Stalattiti e stalagmiti sono ora ammassi di cristalli, con un minerale diverso per ciascuno dei sette mondi del giorno. Colpiscine una e va in frantumi con uno schianto di vetro invece del tonfo della roccia. Una stalattite che cade lascia il suo zoccolo di roccia al soffitto e si conficca punta avanti nel pavimento.

### es-ES  (308 chars)
Las estalactitas y estalagmitas ahora son racimos de cristal, con un mineral distinto para cada uno de los siete mundos del día. Rómpela y estalla en esquirlas de verdad con un chasquido de cristal en vez de un golpe de piedra. Una estalactita que cae deja atrás su base de roca y clava la punta en el suelo.

### pt-BR  (301 chars)
Estalactites e estalagmites agora são aglomerados de cristal, cada um dos sete mundos do dia com seu próprio mineral. Quebre uma e ela se estilhaça em cacos de verdade, com um estalo de vidro em vez de um baque de pedra. Uma estalactite que cai deixa a base de rocha para trás e crava a ponta no chão.

### ja-JP  (119 chars)
鍾乳石と石筍が結晶の集まりになりました。7つの曜日の世界それぞれに固有の鉱物が使われています。壊すと岩のような鈍い音ではなく、ガラスのように砕けて本物の破片が飛び散ります。落下する鍾乳石は岩の台座を天井に残し、先端から床に突き刺さります。

### ko-KR  (137 chars)
종유석과 석순이 이제 크리스털 군집이 되었고, 하루하루의 일곱 세계마다 고유한 광물을 갖습니다. 부수면 돌 부딪는 둔탁한 소리 대신 유리처럼 쨍하게 깨지며 진짜 파편이 튑니다. 떨어지는 종유석은 바위 받침을 천장에 남기고 끝부터 바닥에 박힙니다.

### zh-TW  (89 chars)
鐘乳石與石筍現在是水晶簇，每個曜日世界都有自己的礦物。打碎它會發出清脆的玻璃碎裂聲並濺出真正的碎片，而不是沉悶的石頭撞擊聲。掉落的鐘乳石會把岩石底座留在天花板上，尖端先插進地面。

### ru-RU  (286 chars)
Сталактиты и сталагмиты теперь кристаллические друзы, у каждого из семи миров дня свой минерал. Разбей такой - и он рассыпается настоящими осколками со стеклянным звоном вместо каменного стука. Падающий сталактит оставляет каменное основание на потолке и втыкается в пол остриём вперёд.

### ar  (239 chars)
الهوابط والصواعد أصبحت الآن عناقيد بلورية، بمعدن مختلف لكل عالم من عوالم الأيام السبعة. حطّم إحداها فتتناثر شظايا حقيقية بصوت زجاجي رنّان بدل ارتطام الصخر الأجوف. الهابط الساقط يترك قاعدته الصخرية خلفه في السقف وينغرز في الأرض بطرفه أولاً.

### tr-TR  (276 chars)
Sarkıtlar ve dikitler artık kristal kümeleri, günün yedi dünyasının her birinde farklı bir mineralle. Birini kırdığında donuk bir taş darbesi yerine camsı bir çatırtıyla gerçek kırıklara ayrılıyor. Düşen bir sarkıt kayadan yuvasını tavanda bırakıp uç kısmıyla yere saplanıyor.

### id  (316 chars)
Stalaktit dan stalagmit sekarang menjadi kumpulan kristal, dengan mineral berbeda untuk masing-masing dari tujuh dunia harian. Pecahkan satu dan ia hancur berkeping-keping asli dengan suara kaca pecah, bukan dentuman batu. Stalaktit yang jatuh meninggalkan soket batunya dan mendarat dengan ujung menancap ke lantai.

### pl-PL  (314 chars)
Stalaktyty i stalagmity to teraz skupiska kryształów, każdy z siedmiu codziennych światów ma swój własny minerał. Rozbij jeden, a rozpryśnie się na prawdziwe odłamki ze szklanym trzaskiem zamiast głuchego uderzenia kamienia. Spadający stalaktyt zostawia skalne gniazdo na suficie i ląduje wbity czubkiem w podłogę.

### hi-IN  (284 chars)
स्टैलेक्टाइट और स्टैलेग्माइट अब क्रिस्टल के झुरमुट हैं, सातों दिन-दुनिया का अपना अलग खनिज है। किसी को तोड़ने पर पत्थर की सुस्त आवाज़ की जगह असली किरचें कांच जैसी खनक के साथ बिखरती हैं। गिरता हुआ स्टैलेक्टाइट अपना चट्टानी घोंसला छत पर छोड़ जाता है और नोक आगे करके फर्श में धंस जाता है।
