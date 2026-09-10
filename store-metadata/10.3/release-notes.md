# TUNL 10.3 - App Store Connect / Play Console copy (15 locales)

Theme: reachability. Two player-facing changes, both from the 2026-09-10 funnel/audit
pass:

1. **Ship unlock costs cut hard.** The old ladder (cumulative 102,120 shards) put the
   last three ships at ~174 / ~341 days for a perfect player and ~650 / ~1277 days at a
   realistic income - effectively unreachable, and the stardust gate stopped pacing
   anything past VOID. New ladder is cumulative 14,400, so the daily calendar gate is
   the binding constraint at every tier and SOLARIS still lands on day 180.
2. **The opening stretch now teaches "release."** A player who just holds from the
   launch hits the ceiling in ~0.46s and nothing ever taught otherwise. The first ~3
   coins now sit on a gentle arc that starts below the launch line, so taking the first
   one means letting go and gliding down, and the second means holding and climbing.

Also in the build but not worth a release-note line (internal polish): world rank is
hidden on the death screen / title rail until the day's field has >= 50 players, since
below that it renders "#1 / 2" and reads as "nobody plays this."

Two fields, two purposes:
- **Werbetexte** (App Store Connect "Promotional Text" only, 170-char limit) - reused
  verbatim from 9.1/10.0/10.1/10.2, since the core pitch has not changed. NOTE: this
  field has reset to EMPTY on ASC across a version bump before despite being filled the
  release prior - always re-paste it explicitly, every release, never assume it carried
  forward.
- **Neues in dieser Version** (What's New, version-specific) - real 10.3 content, under
  500 chars/locale so it doubles as Google Play release notes.

No em dashes anywhere (project rule) - hyphen-minus with spaces instead.

---

## Promotional Text (Werbetexte, 170-char limit, evergreen - unchanged from 9.1/10.0/10.1/10.2)

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
Every ship is now far easier to unlock. We cut the cost of every paid ship sharply, so the full hangar is a fair goal instead of an endless grind. New pilots also get a smoother first run: the opening coins now guide you through the whole control - release to glide down, hold to climb back up.

### de
Jedes Schiff lässt sich jetzt viel leichter freischalten. Wir haben die Kosten aller kostenpflichtigen Schiffe deutlich gesenkt - der komplette Hangar ist ein faires Ziel statt endlosem Grind. Auch neue Piloten starten sanfter: Die ersten Münzen führen dich jetzt durch die ganze Steuerung - loslassen zum Gleiten, halten zum Steigen.

### fr
Chaque vaisseau est bien plus facile à débloquer. Nous avons fortement réduit le coût de tous les vaisseaux payants : le hangar complet devient un objectif atteignable, plus une quête sans fin. Les nouveaux pilotes démarrent aussi plus en douceur : les premières pièces guident toute la prise en main - relâche pour descendre, maintiens pour remonter.

### it
Ogni nave ora è molto più facile da sbloccare. Abbiamo ridotto nettamente il costo di tutte le navi a pagamento: l'hangar completo diventa un obiettivo giusto, non un grind infinito. Anche i nuovi piloti partono più dolcemente: le prime monete ti guidano attraverso tutti i comandi - rilascia per planare, tieni premuto per risalire.

### es
Cada nave es ahora mucho más fácil de desbloquear. Hemos reducido mucho el coste de todas las naves de pago: el hangar completo es una meta justa, no un farmeo sin fin. Los nuevos pilotos también empiezan con más suavidad: las primeras monedas te guían por todo el control - suelta para planear, mantén para subir.

### pt-BR
Cada nave ficou muito mais fácil de desbloquear. Cortamos bastante o custo de todas as naves pagas: o hangar completo virou uma meta justa, não uma grind sem fim. Os novos pilotos também começam mais suave: as primeiras moedas guiam você por todo o controle - solte para planar, segure para subir.

### pl
Każdy statek jest teraz dużo łatwiejszy do odblokowania. Mocno obniżyliśmy koszt wszystkich płatnych statków - pełny hangar to uczciwy cel, a nie niekończący się grind. Nowi piloci też zaczynają łagodniej: pierwsze monety prowadzą przez całe sterowanie - puść, by szybować w dół, przytrzymaj, by wznieść się z powrotem.

### ja
すべての機体がずっとアンロックしやすくなりました。有料機体すべてのコストを大幅に引き下げ、全機体の格納庫が終わりのない作業ではなく、正当な目標になりました。新人パイロットのスタートもより滑らかに。最初のコインが操作のすべてを導きます - 離して滑空、押して上昇。

### ko
모든 기체를 훨씬 더 쉽게 잠금 해제할 수 있습니다. 유료 기체 전부의 비용을 크게 낮춰, 전체 격납고가 끝없는 노가다가 아닌 정당한 목표가 되었습니다. 새 파일럿의 첫 판도 더 부드럽게. 시작 코인들이 조작 전체를 안내합니다 - 손을 떼면 활공, 누르면 상승.

### zh
每架船艦都更容易解鎖了。我們大幅調降了所有付費船艦的花費，整座機庫如今是個合理的目標，而非沒完沒了的刷取。新手起步也更平順：開頭的金幣會帶你熟悉完整操作 - 鬆開下滑，按住爬升。

### ru
Каждый корабль теперь гораздо проще открыть. Мы сильно снизили стоимость всех платных кораблей - полный ангар стал честной целью, а не бесконечным гриндом. Новые пилоты тоже стартуют мягче: первые монеты проведут вас через всё управление - отпусти, чтобы планировать вниз, держи, чтобы подниматься.

### ar
صار فتح كل مركبة أسهل بكثير الآن. خفّضنا كلفة كل المركبات المدفوعة بشكل كبير، فصارت الحظيرة كاملةً هدفًا عادلًا بدل الكدح الذي لا ينتهي. والطيارون الجدد يبدؤون بسلاسة أكبر: العملات الأولى ترشدك إلى التحكم كله - اترك للانزلاق نزولًا، واضغط للصعود.

### tr
Her gemi artık çok daha kolay açılıyor. Tüm ücretli gemilerin maliyetini ciddi şekilde düşürdük - eksiksiz hangar bitmeyen bir grind değil, adil bir hedef. Yeni pilotlar da daha yumuşak başlıyor: açılıştaki paralar seni kontrolün tamamında yönlendiriyor - süzülmek için bırak, tırmanmak için basılı tut.

### id
Setiap kapal kini jauh lebih mudah dibuka. Kami memangkas banyak biaya semua kapal berbayar - seluruh hanggar jadi target yang adil, bukan grind tanpa akhir. Pilot baru juga mulai lebih mulus: koin pembuka kini memandu seluruh kontrol - lepas untuk meluncur turun, tahan untuk naik lagi.

### hi
अब हर जहाज़ अनलॉक करना कहीं आसान है। हमने सभी सशुल्क जहाज़ों की लागत काफ़ी घटा दी है - पूरा हैंगर एक अंतहीन ग्राइंड नहीं, बल्कि एक उचित लक्ष्य है। नए पायलट भी अधिक आराम से शुरुआत करते हैं: शुरुआती सिक्के अब आपको पूरे नियंत्रण से परिचित कराते हैं - नीचे सरकने के लिए छोड़ें, फिर से ऊपर चढ़ने के लिए दबाए रखें।
