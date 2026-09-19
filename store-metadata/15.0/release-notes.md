# TUNL 15.0 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: the run now starts outside the cave, and the ship is finally drawn like it flies.
Changes since 14.2 (14.3 was never submitted anywhere and was renamed to 15.0):

1. **Every run opens over the day's city at dusk** and flies through a rock mouth into the
   tunnel, with an "ENTERING THE TUNL" banner. Camera only before world-x 0, so the shared
   daily cave, the score and the sectors are untouched.
2. **The flying ship is a 3/4 side view** (`SHIP_VIEW_3D`): wings sweep back with the speed
   you feel, the hull rolls with the climb rate, and the warp ring grants a barrel roll.
   Hangar, shop and share card stay top-down.
3. **Sound/UX pass** (the old 14.3): own sounds for hull scratch and revive, stereo panning
   around the ship, audible telegraphs before a cannon fires and before a loose stalactite
   drops, cave reverb on impacts, a low turbofan spool-up, three-level music/sound settings,
   and an interruption pause when focus is lost mid-run.
4. **The soft walls are gone.** Walls are lethal from the mouth on; the two hull scratches now
   cover the whole run instead of expiring at sector 3, and their grace protects against the
   wall only.
5. **Local records reset once** on first launch (flag `tunnel_record_reset_v15`). Shards,
   stardust, ships, achievements and lifetime counters are untouched.

Item 5 is in the copy on purpose: without it the reset reads as a bug and lands as a review.
Deliberately NOT in the copy: the darker tunnel start, the 0.3s longer idle glide, the 0.2s
shorter continue offer, and anything with a number in it (dB, seconds, degrees) - qualitative
only, same rule as 14.2. Every locale is under Google Play's 500-character limit (asserted by
the generator, counts below), so the same copy doubles as App Store Connect's "Neues in dieser
Version". No em dashes.

Werbetexte (ASC promotional text) is REWRITTEN for 15.0 - reasoning in that section below.
It has to be pasted either way, because ASC leaves the field empty on every new version
(see feedback_promo_text_werbetexte).

Store assets for this version: `Screenshots/iOS_15.0/` - 6 portrait screenshots x 15 locales
x 3 formats, `app-preview-1920x886.mp4` for ASC, and the Play promo video at
https://youtu.be/OCO1rRPbX-M (16:9, landscape).

---

## Promotional Text (Werbetexte, 170-char limit)

**Changed for 15.0** (previous wording held since 9.1, kept below for a one-field revert).
Two reasons, both about what this field IS: it is the only listing field that can be edited
WITHOUT submitting a build, so spending it on evergreen copy wastes its one property; and
the old second sentence, "Hold to climb, release to drop", is now taught far better by
screenshot 3, whose headline is exactly that with the subhead "One touch. That's the whole
game." The slot it frees goes to the 15.0 opening, which is the most striking thing in the
new gallery and in the preview video, so the first line a visitor reads and the first image
they see are the same idea.

Kept deliberately: the daily shared cave leads (it is the only claim no competitor can
make), and "before it is gone forever" closes. The control scheme is not in the promo text
any more - it is in the description, on screenshot 3 and in the first seconds of the video.

Revert line if this reads worse on the live page (en-US, and the same pattern per locale):
"One cave a day, the same one for every player on Earth. Hold to climb, release to drop, and
see how far you get before it is gone forever."

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

---

---

## What's New / Release Notes

### en-US  (416 chars)
Every run now takes off over a city at dusk and dives through a rock mouth into the cave. The ship is drawn from a new 3/4 side view: the wings sweep back as you get faster, and the warp ring throws you into a barrel roll. Cannons and loose stalactites warn you before they hit, sound is stereo and echoes off the rock, and music and effects each have a quieter setting. Personal records reset once with this update.

### de-DE  (451 chars)
Jeder Flug startet jetzt über einer Stadt in der Dämmerung und taucht durch ein Felsentor in die Höhle. Das Schiff wird in neuer 3/4-Seitenansicht gezeigt: Die Flügel klappen mit steigendem Tempo nach hinten, und der Warp-Ring wirft dich in eine Fassrolle. Kanonen und lose Stalaktiten warnen, bevor sie treffen, der Ton ist stereo und hallt vom Fels, und Musik und Effekte haben je eine leise Stufe. Persönliche Rekorde werden einmalig zurückgesetzt.

### fr-FR  (435 chars)
Chaque vol décolle maintenant au-dessus d'une ville au crépuscule et plonge dans la grotte par une bouche de roche. Le vaisseau est vu en 3/4 : les ailes se replient quand tu accélères, et l'anneau de warp te lance dans un tonneau. Canons et stalactites détachées préviennent avant de frapper, le son est en stéréo et résonne sur la roche, musique et effets ont chacun un niveau bas. Les records personnels sont réinitialisés une fois.

### it-IT  (407 chars)
Ogni volo ora decolla sopra una città al tramonto e si tuffa nella grotta attraverso una bocca di roccia. La nave si vede in 3/4: le ali si piegano all'indietro con la velocità e l'anello warp ti lancia in un tonneau. Cannoni e stalattiti staccate avvisano prima di colpire, l'audio è stereo e riecheggia sulla roccia, musica ed effetti hanno un livello basso. I record personali vengono azzerati una volta.

### es-ES  (388 chars)
Cada vuelo despega ahora sobre una ciudad al anochecer y se adentra en la cueva por una boca de roca. La nave se ve en 3/4: las alas se pliegan al ganar velocidad y el anillo de warp te lanza a un tonel. Cañones y estalactitas sueltas avisan antes de golpear, el sonido es estéreo y resuena en la roca, y música y efectos tienen un nivel bajo. Los récords personales se reinician una vez.

### pt-BR  (362 chars)
Todo voo agora decola sobre uma cidade ao entardecer e mergulha na caverna por uma boca de rocha. A nave aparece em 3/4: as asas recuam conforme você acelera e o anel de warp te joga num tonel. Canhões e estalactites soltas avisam antes de acertar, o som é estéreo e ecoa na rocha, e música e efeitos têm um nível baixo. Os recordes pessoais são zerados uma vez.

### ja-JP  (180 chars)
すべての飛行が夕暮れの街から離陸し、岩の入り口を抜けて洞窟へ飛び込むようになりました。機体は新しい3/4視点で描かれ、速度が上がると主翼が後退し、ワープリングではバレルロールを決めます。大砲と落ちかけの鍾乳石は当たる前に音で警告し、サウンドはステレオで岩に反響します。音楽と効果音にはそれぞれ小音量の段階が加わりました。自己記録は今回一度だけリセットされます。

### ko-KR  (208 chars)
이제 모든 비행이 황혼의 도시 위에서 이륙해 바위 입구를 지나 동굴로 들어갑니다. 기체는 새로운 3/4 시점으로 그려지고, 속도가 붙으면 날개가 뒤로 접히며 워프 고리에서는 배럴 롤을 돕니다. 대포와 떨어지려는 종유석은 맞기 전에 소리로 경고하고, 사운드는 스테레오로 바위에 울립니다. 음악과 효과음에 각각 작게 설정이 생겼습니다. 개인 기록은 이번에 한 번 초기화됩니다.

### zh-TW  (133 chars)
每一趟飛行現在都從黃昏的城市起飛，穿過岩石入口衝進洞窟。飛船改以全新的3/4視角呈現：速度越快機翼越往後收，穿越傳送環時還會來個橫滾。大砲與鬆動的鐘乳石在擊中前會先出聲警告，音效改為立體聲並在岩壁間回響，音樂與音效各自多了小聲的級別。個人紀錄會在本次更新後重置一次。

### ru-RU  (408 chars)
Каждый полёт теперь начинается над городом в сумерках и ныряет в пещеру через каменный проём. Корабль показан в новом ракурсе три четверти: крылья складываются назад с ростом скорости, а кольцо варпа закручивает тебя в бочку. Пушки и сорвавшиеся сталактиты предупреждают звуком до удара, звук стал стерео и отражается от скал, у музыки и эффектов появился тихий уровень. Личные рекорды один раз сбрасываются.

### ar  (360 chars)
كل رحلة تبدأ الآن فوق مدينة عند الغسق وتغوص إلى الكهف عبر فوهة صخرية. تظهر السفينة بزاوية ثلاثة أرباع جديدة: تنطوي الأجنحة للخلف مع زيادة السرعة، وحلقة الانتقال تقذفك في لفة برميلية. المدافع والهوابط المتساقطة تحذّرك بالصوت قبل أن تصيب، والصوت صار ستيريو يتردد صداه على الصخر، ولكل من الموسيقى والمؤثرات مستوى منخفض. تُصفَّر الأرقام القياسية الشخصية مرة واحدة.

### tr-TR  (385 chars)
Her uçuş artık alacakaranlıkta bir şehrin üzerinden kalkıyor ve kaya ağzından mağaraya dalıyor. Gemi yeni bir 3/4 açıdan çiziliyor: hız arttıkça kanatlar geriye yatıyor, warp halkası seni takla attırıyor. Toplar ve kopan sarkıtlar vurmadan önce sesle uyarıyor, ses stereo ve kayada yankılanıyor, müzik ve efektlerin ayrı birer kısık seviyesi var. Kişisel rekorlar bir kez sıfırlanıyor.

### id  (406 chars)
Setiap penerbangan kini lepas landas di atas kota saat senja dan menukik ke gua lewat mulut batu. Kapal digambar dari sudut 3/4 baru: sayap melipat ke belakang saat makin cepat, dan cincin warp melemparmu ke barrel roll. Meriam dan stalaktit yang lepas memberi peringatan suara sebelum mengenai, suara kini stereo dan bergema di batu, serta musik dan efek punya tingkat pelan. Rekor pribadi direset sekali.

### pl-PL  (392 chars)
Każdy lot startuje teraz nad miastem o zmierzchu i nurkuje do jaskini przez skalną bramę. Statek widać w nowym ujęciu 3/4: skrzydła cofają się wraz z prędkością, a pierścień warpu wyrzuca cię w beczkę. Działa i obluzowane stalaktyty ostrzegają dźwiękiem przed trafieniem, dźwięk jest stereo i odbija się od skał, a muzyka i efekty mają po cichszym poziomie. Rekordy osobiste resetują się raz.

### hi-IN  (390 chars)
अब हर उड़ान शाम के शहर के ऊपर से शुरू होती है और चट्टान के मुहाने से गुफा में उतरती है। जहाज़ नए 3/4 कोण से दिखता है: रफ़्तार बढ़ने पर पंख पीछे मुड़ते हैं और वार्प रिंग आपको बैरल रोल में घुमा देती है। तोपें और ढीले स्टैलेक्टाइट टकराने से पहले आवाज़ से चेतावनी देते हैं, ध्वनि अब स्टीरियो है और चट्टानों से गूंजती है, और संगीत व प्रभावों के लिए धीमा स्तर है। निजी रिकॉर्ड एक बार रीसेट होंगे।
