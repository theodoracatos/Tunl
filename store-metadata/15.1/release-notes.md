# TUNL 15.1 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: a small fix. A power-up or coin could sit inside a boulder or on top of a mine, out of
reach. Boulders and mines now keep clear of every coin. 15.1 is a patch on the released 15.0, so
the code diff since the 15.0 build is exactly this one change (`26e2886`).

Deliberately NOT in the copy: any numbers (about 1% of coins sat inside a rock, about 3% on a mine),
the mechanism, and the fact that the daily cave's boulders and mines shift slightly for everyone.
The last one matters for wording: the sentence says the cave is "still the same for every player",
which is true (identical on all screen sizes, asserted by `test-cave.js`); it does not say the cave
is unchanged from 15.0, because it is not. Same qualitative-only rule as 14.2 and 15.0. Every locale
is under Google Play's 500-character limit (asserted by the generator, counts below), so the same
copy doubles as App Store Connect's "Neues in dieser Version". No em dashes.

Promotional text (Werbetexte): UNCHANGED from 15.0, copied below so it can be pasted, because ASC
leaves the field empty on every new version (see feedback_promo_text_werbetexte). Nothing about the
core pitch changed, so it is not rewritten for a patch.

**DECISION (user, 2026-09-20): the store texts stay the 15.0 texts.** 15.1 is only a fix, so Play
Console's 15.1 release (versionCode 47) went out with the UNCHANGED 15.0 "What's New" copy from
`store-metadata/15.0/release-notes.md` (15 locales, pasted as-is), and the store listing and
Werbetexte were not touched. The fix-specific "What's New" below was NOT used; it is kept only as a
fallback if a store ever insists on version-specific notes.

Versions: iOS marketing 15.1 / build 53, Android versionName 15.1 / versionCode 47.
Store assets: none new. The 15.0 screenshots, preview video and Play promo video stay as they are.

---

## Promotional Text (Werbetexte, 170-char limit) - same as 15.0

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

### en-US  (259 chars)
Fixed: power-ups and coins could appear inside a boulder or on top of a mine, where you could not reach them. Rocks and mines now keep clear of every pickup, so everything you see is something you can fly to. The daily cave is still the same for every player.

### de-DE  (285 chars)
Behoben: Power-ups und Münzen konnten in einem Felsen oder auf einer Mine erscheinen, wo du sie nicht erreichen konntest. Felsen und Minen halten jetzt Abstand zu jedem Pickup, sodass du alles, was du siehst, auch erreichen kannst. Die Tageshöhle ist weiterhin für alle Spieler gleich.

### fr-FR  (273 chars)
Corrigé : des bonus et des pièces pouvaient apparaître dans un rocher ou sur une mine, hors de portée. Les rochers et les mines laissent maintenant de la place à chaque objet : tout ce que tu vois, tu peux l'atteindre. La grotte du jour reste la même pour tous les joueurs.

### it-IT  (262 chars)
Corretto: potenziamenti e monete potevano comparire dentro una roccia o su una mina, dove non potevi raggiungerli. Ora rocce e mine restano a distanza da ogni oggetto: tutto ciò che vedi puoi raggiungerlo. La grotta del giorno resta uguale per tutti i giocatori.

### es-ES  (272 chars)
Corregido: los potenciadores y las monedas podían aparecer dentro de una roca o sobre una mina, fuera de tu alcance. Ahora las rocas y las minas se apartan de cada objeto: todo lo que ves, puedes alcanzarlo. La cueva del día sigue siendo la misma para todos los jugadores.

### pt-BR  (255 chars)
Corrigido: power-ups e moedas podiam aparecer dentro de uma rocha ou sobre uma mina, fora do seu alcance. Agora rochas e minas ficam longe de cada item: tudo o que você vê, você consegue alcançar. A caverna do dia continua a mesma para todos os jogadores.

### ja-JP  (106 chars)
修正：パワーアップやコインが岩の中や地雷の上に出現し、取れないことがありました。岩と地雷が各アイテムを避けて配置されるようになり、見えるものはすべて取りに行けます。その日の洞窟は、引き続き全プレイヤーで同じです。

### ko-KR  (130 chars)
수정: 파워업과 코인이 바위 안이나 지뢰 위에 나타나 닿을 수 없는 경우가 있었습니다. 이제 바위와 지뢰가 모든 아이템을 피해 배치되어, 눈에 보이는 것은 전부 잡으러 갈 수 있습니다. 오늘의 동굴은 여전히 모든 플레이어가 같습니다.

### zh-TW  (67 chars)
修正：能量道具和金幣可能出現在岩石裡或地雷上，讓人拿不到。現在岩石和地雷會避開每個道具，看得到的都飛得到。每日洞窟對所有玩家依然相同。

### ru-RU  (223 chars)
Исправлено: бонусы и монеты могли появиться внутри скалы или на мине, где их было не достать. Теперь скалы и мины обходят каждый предмет: всё, что ты видишь, можно достать. Пещера дня по-прежнему одинакова для всех игроков.

### ar  (204 chars)
تم الإصلاح: كان من الممكن أن تظهر التعزيزات والعملات داخل صخرة أو فوق لغم فلا يمكن الوصول إليها. الآن تبتعد الصخور والألغام عن كل عنصر، فكل ما تراه يمكنك الوصول إليه. كهف اليوم ما زال نفسه لجميع اللاعبين.

### tr-TR  (250 chars)
Düzeltildi: güçlendiriciler ve madeni paralar bir kayanın içinde ya da bir mayının üstünde çıkabiliyor, ulaşılamıyordu. Artık kayalar ve mayınlar her nesneden uzak duruyor: gördüğün her şeye ulaşabilirsin. Günün mağarası hâlâ tüm oyuncular için aynı.

### id  (229 chars)
Diperbaiki: power-up dan koin bisa muncul di dalam batu atau di atas ranjau sehingga tidak terjangkau. Sekarang batu dan ranjau menjauhi setiap item: semua yang kamu lihat bisa dijangkau. Gua harian tetap sama untuk semua pemain.

### pl-PL  (234 chars)
Poprawiono: wzmocnienia i monety mogły pojawić się wewnątrz skały lub na minie, poza zasięgiem. Teraz skały i miny omijają każdy przedmiot: wszystko, co widzisz, możesz zdobyć. Jaskinia dnia nadal jest taka sama dla wszystkich graczy.

### hi-IN  (246 chars)
ठीक किया गया: पावर-अप और सिक्के कभी चट्टान के अंदर या माइन के ऊपर आ जाते थे, जहाँ पहुँचना संभव नहीं था। अब चट्टानें और माइन हर आइटम से दूर रहती हैं, इसलिए जो भी दिखता है, उस तक पहुँचा जा सकता है। आज की गुफा अब भी सभी खिलाड़ियों के लिए एक जैसी है।
