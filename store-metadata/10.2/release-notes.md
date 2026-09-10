# TUNL 10.2 - App Store Connect / Play Console copy (15 locales)

Theme: physics feel adjustment, no new gameplay. Real-player feedback on Reddit
(2026-09-09) said the ascend/descend acceleration felt too fast, with deaths coming
before the run's rush ever landed. THRUST was pulled back from 3400 to 2700 in
`src/constants.js` (the documented middle-ground walk-back already noted in CLAUDE.md
from when it was originally tuned up), then nudged back up to 3100 the same day after
2700 played too floaty. GRAVITY and MAX_VY are unchanged throughout. Net-up is now 1800
vs net-down 1300 (was 2100 vs 1300 pre-9.x, 1400 vs 1300 at the too-soft 2700 pass) -
climbing still reads as clearly more responsive than falling, just without the
near-instant snap to the climb cap the original tuning had.

Two fields, two purposes:
- **Werbetexte** (App Store Connect "Promotional Text" only, 170-char limit) - reused
  verbatim from 9.1/10.0/10.1, since the core pitch hasn't changed. NOTE: this field has
  reset to EMPTY on ASC before across a version bump despite being filled the release
  prior (see store-metadata/10.0/release-notes.md) - always re-paste it explicitly,
  every release, never assume it carried forward.
- **Neues in dieser Version** (What's New, version-specific) - real 10.2 content (the
  thrust retune), under 500 chars/locale so it doubles as Google Play release notes.

No em dashes anywhere (project rule) - hyphen-minus with spaces instead.

---

## Promotional Text (Werbetexte, 170-char limit, evergreen - unchanged from 9.1/10.0/10.1)

### en
One cave a day, the same one for every player on Earth. Hold to climb, release to drop, and see how far you get before it is gone forever.

### de
Eine Höhle pro Tag, für alle Spieler weltweit dieselbe. Halten zum Steigen, loslassen zum Fallen. Wie weit kommst du, bevor sie für immer verschwindet?

### fr
Une grotte par jour, la même pour tous les joueurs du monde. Maintiens pour monter, relâche pour tomber. Jusqu'où iras-tu avant qu'elle disparaisse à jamais ?

### it
Una grotta al giorno, la stessa per ogni giocatore del mondo. Tieni premuto per salire, rilascia per scendere. Quanto arrivi prima che sparisca per sempre?

### es
Una cueva al día, la misma para cada jugador del mundo. Mantén para subir, suelta para caer. ¿Hasta dónde llegas antes de que desaparezca para siempre?

### pt-BR
Uma caverna por dia, a mesma para todos os jogadores do mundo. Segure para subir, solte para cair. Até onde você chega antes de ela sumir para sempre?

### pl
Jedna jaskinia dziennie, ta sama dla każdego gracza na świecie. Przytrzymaj, aby się wznosić, puść, aby spadać. Jak daleko dolecisz, zanim zniknie na zawsze?

### ja
毎日ひとつの洞窟。世界中のプレイヤーが同じ洞窟を飛ぶ。押して上昇、離して落下。永遠に消える前にどこまで行けるか。

### ko
하루에 동굴 하나, 전 세계 플레이어가 똑같은 곳을 난다. 누르면 오르고, 손을 떼면 떨어진다. 영원히 사라지기 전에 얼마나 멀리 갈 수 있을까?

### zh
每天一個洞窟，全球玩家飛的都是同一個。按住上升，鬆開下降。在它永遠消失前，你能飛多遠？

### ru
Одна пещера в день, одна и та же для всех игроков мира. Держи, чтобы подниматься, отпусти, чтобы падать. Как далеко ты долетишь, пока она не исчезнет навсегда?

### ar
كهف واحد كل يوم، هو نفسه لكل لاعب في العالم. اضغط للصعود، اترك للهبوط. إلى أي مدى تصل قبل أن يختفي إلى الأبد؟

### tr
Günde bir mağara, dünyadaki her oyuncu için aynısı. Yükselmek için basılı tut, düşmek için bırak. Sonsuza dek kaybolmadan ne kadar ilerlersin?

### id
Satu gua per hari, sama untuk semua pemain di dunia. Tahan untuk naik, lepas untuk turun. Sejauh apa kamu bisa sebelum gua itu lenyap selamanya?

### hi
हर दिन एक गुफा, दुनिया के हर खिलाड़ी के लिए वही एक। ऊपर उठने के लिए दबाए रखें, गिरने के लिए छोड़ें। गायब होने से पहले आप कितनी दूर जाते हैं?

---

## What's New / Neues in dieser Version (version-specific, ~500 char budget)

### en
Eased the climb and fall speed after player feedback - it felt too snappy, with deaths coming before the rush kicked in. Same hold-to-fly feel, just more room to enjoy the ride before the cave closes in.

### de
Steig- und Falltempo nach Spieler-Feedback abgeschwächt - es fühlte sich zu schnell an, und der Tod kam oft, bevor der Kick überhaupt einsetzte. Gleiches Hold-to-Fly-Gefühl, nur mehr Raum, den Ritt zu genießen, bevor die Höhle sich schließt.

### fr
Vitesse de montée et de chute adoucie après les retours des joueurs - ça semblait trop brusque, et la mort arrivait souvent avant même que la montée d'adrénaline commence. Même sensation de vol en maintenant, mais plus de marge pour profiter de la descente avant que la grotte ne se referme.

### it
Velocità di salita e caduta ammorbidita dopo il feedback dei giocatori - sembrava troppo scattante, con la morte che arrivava prima ancora di sentire l'adrenalina. Stessa sensazione di volo a pressione prolungata, solo più spazio per goderti la corsa prima che la grotta si chiuda.

### es
Suavizada la velocidad de subida y caída tras el feedback de los jugadores - se sentía demasiado brusca, y la muerte llegaba antes de sentir la adrenalina. Misma sensación de vuelo mantenido, solo con más margen para disfrutar el vuelo antes de que la cueva se cierre.

### pt-BR
Suavizamos a velocidade de subida e queda após o feedback dos jogadores - estava muito brusca, e a morte chegava antes da adrenalina começar. A mesma sensação de voo ao segurar, só com mais espaço para aproveitar o voo antes de a caverna se fechar.

### pl
Złagodziliśmy prędkość wznoszenia i opadania po opiniach graczy - reakcja była zbyt gwałtowna, a śmierć przychodziła, zanim dreszczyk emocji zdążył się rozwinąć. To samo poczucie sterowania przytrzymaniem, tylko więcej czasu, by nacieszyć się lotem, zanim jaskinia się zamknie.

### ja
プレイヤーからのフィードバックを受け、上昇・落下速度を調整しました。以前は反応が急すぎて、興奮を味わう前に墜落することが多かったはず。ホールドで飛ぶ操作感はそのままに、洞窟が閉じるまでの飛行をもっと楽しめるようになりました。

### ko
플레이어 피드백을 반영해 상승·하강 속도를 완화했습니다. 예전에는 반응이 너무 급격해서 손맛을 느끼기도 전에 죽는 경우가 많았죠. 누르고 나는 조작감은 그대로, 동굴이 닫히기 전까지 비행을 더 즐길 여유가 생겼습니다.

### zh
根據玩家意見，調整了上升與下降的速度－之前反應太過靈敏，常常還沒感受到快感就墜毀了。按住飛行的手感不變，只是在洞窟合攏前，多了些空間享受這趟飛行。

### ru
Смягчили скорость подъёма и падения по отзывам игроков - раньше управление было слишком резким, и смерть наступала раньше, чем успевал прочувствовать кураж. Управление зажатием осталось прежним, просто теперь больше времени насладиться полётом, прежде чем пещера сомкнётся.

### ar
خفّفنا سرعة الصعود والهبوط بناءً على آراء اللاعبين - كانت الاستجابة سريعة جدًا، والموت يأتي قبل أن تشعر بالإثارة. نفس إحساس الطيران بالضغط المستمر، لكن مع مساحة أكبر للاستمتاع بالرحلة قبل أن ينغلق الكهف.

### tr
Oyuncu geri bildirimlerine göre yükselme ve düşme hızını yumuşattık - tepki çok anide hissettiriyordu ve heyecanı yaşamadan ölüm geliyordu. Basılı tutarak uçma hissi aynı, sadece mağara kapanmadan önce uçuşun tadını çıkarmak için daha fazla alan var.

### id
Kami melunakkan kecepatan naik dan turun berdasarkan masukan pemain - responsnya terasa terlalu cepat, dan kematian sering datang sebelum sensasi terbangnya terasa. Rasa terbang dengan menahan tetap sama, hanya lebih banyak ruang untuk menikmati penerbangan sebelum gua menutup.

### hi
खिलाड़ियों की प्रतिक्रिया के बाद चढ़ने और गिरने की गति को नरम किया गया - यह बहुत तेज़ महसूस होती थी, और रोमांच महसूस होने से पहले ही मौत आ जाती थी। होल्ड-टू-फ्लाई का एहसास वही है, बस गुफा बंद होने से पहले उड़ान का आनंद लेने के लिए अब ज़्यादा जगह है।
