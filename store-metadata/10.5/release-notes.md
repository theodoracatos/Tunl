# TUNL 10.5 - Play Console / App Store Connect "What's New" copy (15 locales)

Theme: obstacle-timing and cross-device fairness pass (the whole 2026-09-11 balance +
cross-device-fairness pass, plus the browser-playtest boulder/cannon fix on top of it).

1. **Boulders and falling stalactites moved much earlier.** Boulders 84000 -> 5100
   world-px (~score 85), falling stalactites 12000 -> 7800 (~score 130-160), deep-run
   variety 54000 -> 30000 (~score 500). A leaderboard replay had shown none of that
   content was ever actually being seen (median daily best 70, highest ever 169).
2. **Coin-economy re-gate.** Chicane gold and the four capped power-ups are now paced
   in real seconds (not just weighted share), so shield/slow-time/ammo stop pinning at
   their ceiling late in a run; the deep-run gold bar now visibly rises and falls
   instead of sitting maxed. Slow-time's stack cap cut 8s -> 6s to match.
3. **Two placement bugs fixed**: falling stalactites no longer land hovering above the
   floor (the fall distance was frozen at detach instead of tracking the moving
   corridor), and chicane gold coins no longer spawn embedded in the wall (they were
   placed off a stale corridor centre).
4. **Every screen size now flies the exact same daily cave.** Fixed four causes of
   per-device divergence (curves sampled at the wrong x, placement geometry in the
   wrong units, a shared rng stream across spawners, and real-second cadences that
   drifted with scroll speed) - the shared daily leaderboard was previously comparing
   different games on different screens.
5. **Boulders/cannons now honour their own placement rules.** A browser playtest (not
   caught by the automated tests, which only check cross-device identity - not
   real-device feel) found the retry loops added for point 4 walked probes back out
   past the horizon that was supposed to check them, so 15 of 18 boulders and all 28
   cannons in a sample run were placed blind. 12 boulders had one pass through them
   sealed by a stalactite, one had both sealed (an unavoidable death). Fixed by
   widening the shared horizon and testing the actual geometric contract instead of a
   flat-radius proxy for it - 0 sealed passes after, across the same sample.

Both fields' char counts are checked to stay under Google Play's 500/locale release-
notes limit, so the same copy doubles as App Store Connect's "Neues in dieser Version".
No em dashes anywhere (project rule) - hyphen-minus with spaces instead.

Werbetexte (ASC promotional text) is unchanged from 9.1/10.0-10.4 - the core pitch
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
Boulders and falling stalactites now show up much earlier in a run, with deep-run variety kicking in sooner too. Retuned the coin economy, fixed a few placement bugs, and every screen size now flies the exact same daily cave.

### de-DE
Felsbrocken und fallende Stalaktiten tauchen jetzt viel früher in einem Lauf auf, und die Deep-Run-Vielfalt setzt ebenfalls früher ein. Außerdem wurde die Münzökonomie nachjustiert, ein paar Platzierungsfehler behoben, und jede Bildschirmgröße fliegt jetzt exakt dieselbe Tageshöhle.

### fr-FR
Les rochers et les stalactites tombantes apparaissent désormais bien plus tôt dans une partie, et la variété des parties longues démarre aussi plus vite. Économie des pièces réajustée, quelques bugs de placement corrigés, et chaque taille d'écran vole désormais exactement la même grotte du jour.

### it-IT
Massi e stalattiti cadenti compaiono ora molto prima in una partita, e la varietà delle partite profonde si attiva anche prima. Economia delle monete riequilibrata, corretti alcuni bug di posizionamento, e ogni dimensione di schermo vola ora esattamente la stessa grotta del giorno.

### es-ES
Las rocas y las estalactitas que caen aparecen ahora mucho antes en una partida, y la variedad de partidas profundas también llega antes. Se reajustó la economía de monedas, se corrigieron varios errores de colocación, y ahora cada tamaño de pantalla vuela exactamente la misma cueva del día.

### pt-BR
Rochas e estalactites que caem agora aparecem bem mais cedo em uma partida, e a variedade de partidas profundas também começa antes. Reequilibramos a economia de moedas, corrigimos alguns bugs de posicionamento, e agora cada tamanho de tela voa exatamente a mesma caverna do dia.

### ja-JP
岩と落下する鍾乳石が、プレイのかなり早い段階で出てくるようになりました。ディープラン特有のバリエーションも早めに登場します。コイン経済を再調整し、配置に関するいくつかのバグを修正。さらに、どの画面サイズでも同じ「今日の洞窟」を飛ぶようになりました。

### ko-KR
바위와 낙하하는 종유석이 이제 플레이 훨씬 초반부터 등장합니다. 딥런 다양성도 더 일찍 시작됩니다. 코인 경제를 재조정하고 배치 관련 버그 몇 가지를 수정했으며, 이제 어떤 화면 크기든 오늘의 동굴을 똑같이 비행합니다.

### zh-TW
巨石與掉落的鐘乳石現在會在遊玩早期就出現，深度遊玩的變化也提前登場。調整了金幣經濟，修正了一些放置相關的錯誤，而且現在無論螢幕大小，飛的都是完全相同的每日洞窟。

### ru-RU
Валуны и падающие сталактиты теперь появляются намного раньше в забеге, а разнообразие глубокого забега тоже включается раньше. Перенастроена экономика монет, исправлено несколько ошибок расстановки, и теперь любой размер экрана летит по абсолютно одной и той же пещере дня.

### ar
تظهر الصخور والصواعد المتساقطة الآن في وقت أبكر بكثير من الجولة، ويبدأ تنوع الجولات العميقة أيضاً بشكل أسرع. أُعيد ضبط اقتصاد العملات، وأُصلحت بعض أخطاء وضع العناصر، وأصبح كل حجم شاشة يطير الآن في نفس كهف اليوم تماماً.

### tr-TR
Kayalar ve düşen sarkıtlar artık bir oyunda çok daha erken ortaya çıkıyor, derin oyun çeşitliliği de daha erken başlıyor. Madeni para ekonomisi yeniden ayarlandı, birkaç yerleştirme hatası düzeltildi ve artık her ekran boyutu tam olarak aynı günün mağarasında uçuyor.

### id
Batu besar dan stalaktit yang jatuh kini muncul jauh lebih awal dalam permainan, dan variasi permainan mendalam juga dimulai lebih cepat. Ekonomi koin disesuaikan ulang, beberapa bug penempatan diperbaiki, dan sekarang setiap ukuran layar terbang di gua hari yang sama persis.

### pl-PL
Głazy i spadające stalaktyty pojawiają się teraz znacznie wcześniej w przelocie, a różnorodność głębokich przelotów też zaczyna się szybciej. Przetasowano ekonomię monet, naprawiono kilka błędów umieszczania obiektów, a teraz każdy rozmiar ekranu leci dokładnie tą samą jaskinią dnia.

### hi-IN
बोल्डर और गिरते स्टैलेक्टाइट अब दौड़ में कहीं पहले दिखने लगे हैं, और डीप-रन विविधता भी जल्दी शुरू होती है। सिक्कों की अर्थव्यवस्था को फिर से संतुलित किया गया, कुछ प्लेसमेंट बग ठीक किए गए, और अब हर स्क्रीन साइज़ ठीक आज की उसी गुफा में उड़ान भरता है।
