# TUNL 12.2 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: all-time leaderboard reset (both platforms) + one achievement-logic fix.

1. **All-time leaderboard reset, iOS and Android.** The old all-time board's top scores
   were set on builds significantly easier than the current difficulty curve - most of
   them predate the whole 12.0 rebalance (safe opening flight, sector-based flight plan,
   hull scratches, corridor/coin retuning), the same "pre-rebalance, now-too-easy"
   situation that justified the earlier v1->v2 cut, just a much bigger jump this time.
   iOS moved to a new App Store Connect Game Center leaderboard
   (`tunl_highscore_alltime_v3`); Android's Play Games leaderboard resource was
   recreated from scratch (Play has no separate all-time-only resource to swap - Daily/
   Weekly/All-time are views over one score stream). Daily and weekly leaderboards are
   untouched.
2. **"Master of the Fleet" achievement fixed.** It was checking mastery only across the
   ships a player currently owned, so owning just one ship and maxing it alone could
   complete the achievement. It now genuinely requires every ship in the roster (all 8)
   maxed out.

Both fields' char counts are checked to stay under Google Play's 500/locale release-
notes limit, so the same copy doubles as App Store Connect's "Neues in dieser Version".
No em dashes anywhere (project rule) - hyphen-minus with spaces instead.

Werbetexte (ASC promotional text) is unchanged from 9.1/10.0-10.5/12.1 - the core pitch
hasn't moved. Re-pasted in full below anyway per the standing rule (it has reset to
empty on ASC across a version bump before) - don't skip this because "nothing changed."

---

## Promotional Text (Werbetexte, 170-char limit, evergreen - unchanged since 9.1)

### en-US
One cave a day, the same one for every player on Earth. Hold to climb, release to drop, and see how far you get before it is gone forever.

### de-DE
Eine Höhle pro Tag, für alle Spieler weltweit dieselbe. Halten zum Steigen, loslassen zum Fallen. Wie weit kommst du, bevor sie für immer verschwindet?

### fr-FR
Une grotte par jour, la même pour tous les joueurs du monde. Maintiens pour monter, relâche pour tomber. Jusqu'où iras-tu avant qu'elle disparaisse à jamais ?

### it-IT
Una grotta al giorno, la stessa per ogni giocatore del mondo. Tieni premuto per salire, rilascia per scendere. Quanto arrivi prima che sparisca per sempre?

### es-ES
Una cueva al día, la misma para cada jugador del mundo. Mantén para subir, suelta para caer. ¿Hasta dónde llegas antes de que desaparezca para siempre?

### pt-BR
Uma caverna por dia, a mesma para todos os jogadores do mundo. Segure para subir, solte para cair. Até onde você chega antes de ela sumir para sempre?

### ja-JP
毎日ひとつの洞窟。世界中のプレイヤーが同じ洞窟を飛ぶ。押して上昇、離して落下。永遠に消える前にどこまで行けるか。

### ko-KR
하루에 동굴 하나, 전 세계 플레이어가 똑같은 곳을 난다. 누르면 오르고, 손을 떼면 떨어진다. 영원히 사라지기 전에 얼마나 멀리 갈 수 있을까?

### zh-TW
每天一個洞窟，全球玩家飛的都是同一個。按住上升，鬆開下降。在它永遠消失前，你能飛多遠？

### ru-RU
Одна пещера в день, одна и та же для всех игроков мира. Держи, чтобы подниматься, отпусти, чтобы падать. Как далеко ты долетишь, пока она не исчезнет навсегда?

### ar
كهف واحد كل يوم، هو نفسه لكل لاعب في العالم. اضغط للصعود، اترك للهبوط. إلى أي مدى تصل قبل أن يختفي إلى الأبد؟

### tr-TR
Günde bir mağara, dünyadaki her oyuncu için aynısı. Yükselmek için basılı tut, düşmek için bırak. Sonsuza dek kaybolmadan ne kadar ilerlersin?

### id
Satu gua per hari, sama untuk semua pemain di dunia. Tahan untuk naik, lepas untuk turun. Sejauh apa kamu bisa sebelum gua itu lenyap selamanya?

### pl-PL
Jedna jaskinia dziennie, ta sama dla każdego gracza na świecie. Przytrzymaj, aby się wznosić, puść, aby spadać. Jak daleko dolecisz, zanim zniknie na zawsze?

### hi-IN
हर दिन एक गुफा, दुनिया के हर खिलाड़ी के लिए वही एक। ऊपर उठने के लिए दबाए रखें, गिरने के लिए छोड़ें। गायब होने से पहले आप कितनी दूर जाते हैं?

---

## What's New / Release Notes

### en-US
All-time leaderboard reset - the old top scores were set before the big 12.0 rebalance and were no longer a fair bar to chase. Clean slate for everyone. Also fixed the Master of the Fleet achievement to require every ship in the roster, not just the ones you own.

### de-DE
Bestenliste aller Zeiten zurückgesetzt - die alten Bestwerte stammten von vor dem großen 12.0-Rebalancing und waren keine faire Messlatte mehr. Für alle ein sauberer Neuanfang. Außerdem wurde der Erfolg "Meister der Flotte" korrigiert: Jetzt sind wirklich alle Schiffe der Flotte nötig, nicht nur die, die du besitzt.

### fr-FR
Classement de tous les temps réinitialisé - les anciens meilleurs scores dataient d'avant le grand rééquilibrage 12.0 et n'étaient plus une référence juste. Nouveau départ pour tout le monde. Le succès "Maître de la flotte" a aussi été corrigé : il faut désormais vraiment tous les vaisseaux de la flotte, pas seulement ceux que tu possèdes.

### it-IT
Classifica di sempre azzerata - i vecchi punteggi migliori risalivano a prima del grande riequilibrio 12.0 e non erano più un metro di paragone equo. Un nuovo inizio per tutti. Corretto anche il traguardo "Padrone della flotta": ora servono davvero tutte le navi della flotta, non solo quelle che possiedi.

### es-ES
Clasificación histórica reiniciada - las puntuaciones anteriores eran de antes del gran reequilibrio 12.0 y ya no eran un listón justo. Un comienzo limpio para todos. También se corrigió el logro "Amo de la flota": ahora hacen falta de verdad todas las naves de la flota, no solo las que tienes.

### pt-BR
Ranking histórico reiniciado - as pontuações antigas foram feitas antes do grande reequilíbrio da 12.0 e não eram mais uma régua justa. Um recomeço limpo para todo mundo. Também corrigimos a conquista "Mestre da Frota": agora é preciso mesmo todas as naves da frota, não só as que você tem.

### ja-JP
オールタイム・ランキングをリセットしました。以前のハイスコアは大規模な12.0のリバランス前のもので、公平な基準ではなくなっていたためです。全員がまっさらな状態からスタートします。また実績「フリートの覇者」を修正し、所有している機体だけでなく、全ての機体を極める必要があるようにしました。

### ko-KR
올타임 리더보드를 초기화했습니다. 기존 최고 점수는 대규모 12.0 밸런스 조정 이전에 세워진 것이라 더 이상 공정한 기준이 아니었습니다. 모두에게 새로운 출발입니다. 또한 "함대의 지배자" 업적을 수정해 보유한 기체만이 아니라 전체 기체를 마스터해야 달성되도록 했습니다.

### zh-TW
重置了歷代排行榜——舊的最高分是在大型12.0平衡調整之前創下的，已不再是公平的比較基準。所有人都從零開始。也修正了「機隊之王」成就，現在必須真正精通機隊中的每一艘飛船，而不只是你擁有的那些。

### ru-RU
Сброшена таблица рекордов за всё время - старые лучшие результаты были установлены до масштабного ребаланса 12.0 и больше не были честной планкой. Чистый лист для всех. Также исправлено достижение "Хозяин флота": теперь нужны действительно все корабли флота, а не только те, что у тебя есть.

### ar
إعادة ضبط لوحة المتصدرين لكل العصور - كانت أعلى النتائج القديمة قد سُجّلت قبل إعادة الموازنة الكبيرة في الإصدار 12.0 ولم تعد معيارًا عادلًا. بداية نظيفة للجميع. كما تم إصلاح إنجاز "سيد الأسطول" ليتطلب فعلاً كل سفن الأسطول، وليس فقط تلك التي تملكها.

### tr-TR
Tüm zamanların skor tablosu sıfırlandı - eski en yüksek skorlar büyük 12.0 dengeleme güncellemesinden önce belirlenmişti ve artık adil bir ölçüt değildi. Herkes için temiz bir başlangıç. Ayrıca "Filonun Efendisi" başarımı düzeltildi: artık gerçekten filodaki tüm gemiler gerekiyor, sadece sahip olduğun değil.

### id
Papan peringkat sepanjang masa direset - skor tertinggi lama dibuat sebelum penyeimbangan besar 12.0 dan sudah tidak lagi jadi patokan yang adil. Awal yang bersih untuk semua orang. Pencapaian "Penguasa Armada" juga diperbaiki: sekarang benar-benar butuh semua kapal di armada, bukan cuma yang kamu miliki.

### pl-PL
Zresetowano ranking wszech czasów - stare najlepsze wyniki powstały przed dużym rebalansem 12.0 i nie były już uczciwym punktem odniesienia. Czysty start dla wszystkich. Naprawiono też osiągnięcie "Mistrz Floty": teraz naprawdę wymaga wszystkich statków we flocie, a nie tylko tych, które posiadasz.

### hi-IN
ऑल-टाइम लीडरबोर्ड रीसेट कर दिया गया है - पुराने हाई स्कोर बड़े 12.0 रीबैलेंस से पहले के थे और अब निष्पक्ष पैमाना नहीं रह गए थे। सभी के लिए एक साफ़ शुरुआत। साथ ही "मास्टर ऑफ़ द फ़्लीट" उपलब्धि को ठीक किया गया है - अब वाकई पूरे बेड़े के सभी जहाज़ चाहिए, सिर्फ़ आपके पास मौजूद जहाज़ नहीं।
