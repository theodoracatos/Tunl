# TUNL 10.4 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: two new time-based achievements, plus a deep-run coin-economy fix.

1. **Two new Game Center / Play Games achievements**: "One Minute" and "Two Minutes"
   (`tunl_ach_flight_1min` / `tunl_ach_flight_2min`), for staying airborne that long in
   a single run. flightClock in state.js, fired from update.js's play-phase block.
2. **Deep-run coin economy retune** (already in the working tree before this release,
   dated 2026-09-11, `src/systems.js` `makeCoin`): red/blue/orange (shield, slow-time,
   ammo) no longer overshoot their documented ceilings late in a run - red was hitting
   ~26% against a 21% cap. The marathon-phase (score 233-900) share that gold sheds now
   goes to green (magnet) alone instead of being split across all four, since green is
   the one type designed to keep growing through the marathon. Response to a real
   player complaint ("too many shields").

Both fields' char counts are checked to stay under Google Play's 500/locale release-
notes limit, so the same copy doubles as App Store Connect's "Neues in dieser Version".
No em dashes anywhere (project rule) - hyphen-minus with spaces instead.

Werbetexte (ASC promotional text) is unchanged from 10.3 - the core pitch hasn't moved,
so it isn't reproduced here; re-paste the existing evergreen copy when doing the iOS
side (see `store-metadata/10.3/release-notes.md`), don't leave it to reset to empty.

---

## What's New / Release Notes

### en-US
Two new achievements: One Minute and Two Minutes, for staying airborne that long in a single run. Also retuned the deep-run coin mix so shield, slow-time and ammo pickups stop overshooting late in a run, while the magnet shows up more on long marathons.

### de-DE
Zwei neue Erfolge: Eine Minute und Zwei Minuten, fürs so lange In-der-Luft-Bleiben in einem einzigen Lauf. Außerdem wurde die Münzmischung in tiefen Läufen nachjustiert: Schild, Zeitlupe und Munition übertreffen ihr Ziel-Tempo spät im Lauf nicht mehr, der Magnet erscheint dafür häufiger bei langen Marathonläufen.

### fr-FR
Deux nouveaux succès : Une minute et Deux minutes, pour être resté en vol aussi longtemps en une seule partie. Le mélange de pièces en profondeur a aussi été réajusté : bouclier, ralenti et munitions ne dépassent plus leur rythme prévu en fin de partie, tandis que l'aimant apparaît plus souvent lors des longs marathons.

### it-IT
Due nuovi obiettivi: Un minuto e Due minuti, per essere rimasto in volo così a lungo in una singola partita. Rimessa a punto anche la distribuzione delle monete nelle partite profonde: scudo, rallentamento e munizioni non superano più il ritmo previsto a fine partita, mentre il magnete compare più spesso nelle maratone lunghe.

### es-ES
Dos logros nuevos: Un minuto y Dos minutos, por mantenerte en vuelo ese tiempo en una sola partida. También se reajustó la mezcla de monedas en partidas profundas: escudo, ralentización y munición ya no superan su ritmo previsto al final de la partida, y el imán aparece más en las maratones largas.

### pt-BR
Duas novas conquistas: Um minuto e Dois minutos, por ficar no ar esse tempo em uma única partida. Também foi reajustada a mistura de moedas em partidas profundas: escudo, câmera lenta e munição não ultrapassam mais o ritmo previsto no fim da partida, e o ímã aparece mais em maratonas longas.

### ja-JP
新しい実績を2つ追加：「1分間」と「2分間」、1回のプレイでその時間飛行し続けると獲得。さらに深いプレイでのコイン配分も調整：シールド、スロータイム、弾薬のピックアップがプレイ後半で予定より出過ぎないようにし、マグネットは長いマラソンプレイでより多く出現するようにしました。

### ko-KR
새로운 업적 2개 추가: '1분'과 '2분', 한 번의 플레이에서 그만큼 비행을 유지하면 획득. 또한 딥런 코인 구성도 조정: 실드, 슬로우타임, 탄약 픽업이 플레이 후반에 의도한 비율을 넘지 않도록 했고, 마그넷은 긴 마라톤 플레이에서 더 자주 등장합니다.

### zh-TW
新增兩項成就：「一分鐘」與「兩分鐘」，在單次遊玩中持續飛行該時長即可解鎖。同時調整了深度遊玩的金幣配置：護盾、減速與彈藥道具不再於遊玩後期超出預定比例，而磁鐵在長時間馬拉松式遊玩中會更常出現。

### ru-RU
Два новых достижения: «Одна минута» и «Две минуты» - за то, что продержались в воздухе столько времени за один забег. Также перенастроено распределение монет в глубоких забегах: щит, замедление времени и патроны больше не превышают заданный темп ближе к концу забега, а магнит стал появляться чаще в длинных марафонских забегах.

### ar
إنجازان جديدان: دقيقة واحدة ودقيقتان، مقابل البقاء في الجو لتلك المدة في جولة واحدة. كما أُعيد ضبط توزيع العملات في الجولات العميقة: لم تعد عملات الدرع وإبطاء الوقت والذخيرة تتجاوز الوتيرة المقصودة في أواخر الجولة، بينما يظهر المغناطيس أكثر في الجولات الطويلة.

### tr-TR
İki yeni başarım: Bir Dakika ve İki Dakika, tek bir oyunda o kadar süre havada kalmak için. Ayrıca derin oyunlardaki madeni para dağılımı yeniden ayarlandı: kalkan, yavaş zaman ve mühimmat oyunun geç safhalarında hedeflenen oranı aşmıyor, mıknatıs ise uzun maratonlarda daha sık çıkıyor.

### id
Dua pencapaian baru: Satu Menit dan Dua Menit, karena tetap terbang selama itu dalam satu permainan. Distribusi koin pada permainan mendalam juga disesuaikan: koin perisai, perlambatan waktu, dan amunisi tidak lagi melampaui laju yang dimaksud di akhir permainan, sementara magnet lebih sering muncul pada permainan maraton yang panjang.

### pl-PL
Dwa nowe osiągnięcia: Jedna Minuta i Dwie Minuty, za pozostanie w powietrzu tak długo podczas jednego przelotu. Przetasowano też rozkład monet w głębokich przelotach: tarcza, spowolnienie czasu i amunicja nie przekraczają już zamierzonego tempa pod koniec przelotu, a magnes pojawia się częściej podczas długich maratonów.

### hi-IN
दो नए उपलब्धियां: एक मिनट और दो मिनट, एक ही दौड़ में उतनी देर हवा में रहने के लिए। इसके साथ ही गहरी दौड़ों में सिक्कों का मिश्रण भी दोबारा सेट किया गया है: शील्ड, धीमा समय और गोला-बारूद अब दौड़ के अंत में तय दर से आगे नहीं निकलते, जबकि मैग्नेट लंबी मैराथन दौड़ों में ज्यादा बार दिखाई देता है।
