#!/usr/bin/env python3
"""Generate the 8.0 store-listing metadata tree for App Store Connect + Play Console.

No fastlane in this repo (past releases were browser-driven), but the output uses
the fastlane deliver/supply directory layout so it is drop-in if fastlane is ever
added, and so the files map 1:1 onto the console fields.

  store-metadata/8.0/ios/<loc>/     name / subtitle / promotional_text / keywords
                                    / description / release_notes  .txt
  store-metadata/8.0/android/<loc>/ title / short_description / full_description .txt
                                    changelogs/21.txt   (versionCode 21)

16 locale sets: the 15 in-game languages (src/i18n.js LANG_ORDER) plus pt-BR.
pt = European Portuguese, pt-BR = Brazilian (Phase 4 swaps pt-BR for a
Brazil-tailored set; this is the baseline). zh = Traditional Chinese (the game
ships 繁體中文). Folder names are best-guess store locale codes - CONFIRM against
the live consoles before upload (ASC and Play use different code sets; see
project_release_status memory).

All copy uses proper Unicode orthography (real umlauts/accents/tone marks) - the
store fields are full Unicode. Only the em dash is avoided per the repo rule.

Run:  python3 store-metadata/8.0/build-metadata.py
It writes every file, prints a char-count table, and exits non-zero if any field
is over its store limit.
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
VERSION_CODE = 21  # Android versionCode for 8.0

# Hard store limits (characters).
LIM = {
    "ios_name": 30, "ios_subtitle": 30, "ios_promo": 170,
    "ios_keywords": 100, "ios_desc": 4000, "ios_notes": 4000,
    "play_title": 30, "play_short": 80, "play_full": 4000, "play_notes": 500,
}

# Folder name -> (App Store Connect locale, Play Console locale) - VERIFY at upload.
LOCALE_CODES = {
    "en":    ("en-US", "en-US"),
    "de":    ("de-DE", "de-DE"),
    "fr":    ("fr-FR", "fr-FR"),
    "it":    ("it",    "it-IT"),
    "es":    ("es-ES", "es-ES"),
    "pt":    ("pt-PT", "pt-PT"),
    "pt-BR": ("pt-BR", "pt-BR"),
    "ja":    ("ja",    "ja-JP"),
    "ko":    ("ko",    "ko-KR"),
    "zh":    ("zh-Hant", "zh-TW"),
    "ru":    ("ru",    "ru-RU"),
    "ar":    ("ar-SA", "ar"),
    "tr":    ("tr",    "tr-TR"),
    "id":    ("id",    "id"),
    "vi":    ("vi",    "vi"),
    "hi":    ("hi",    "hi-IN"),
}

M = {}

# ------------------------------------------------------------------ EN (master)
M["en"] = dict(
    ios_name="TUNL: Daily Cave Flyer",
    ios_subtitle="Hold to fly. A new cave daily.",
    ios_promo=(
        "Everyone on Earth flies the exact same cave today. Tomorrow it is gone "
        "and a new one takes its place. How far can you get before it does?"),
    ios_keywords="one tap,flappy,cave,tunnel,flying,arcade,endless,ghost,leaderboard,reflex,one button,skill",
    ios_desc="""Hold the screen and your ship climbs. Let go and gravity takes over. That is the whole game - and it is harder than it sounds.

Every day, TUNL builds one cave from the date. Everyone on Earth flies that exact same cave, then it is gone forever and a new one takes its place. Your first good run of the day leaves a ghost. Chase it. Beat it.

The corridor gets tighter the deeper you go. Grab coins to widen it and power-ups to survive: shield, magnet, slow-time, bombs and more. Skim the rock without touching it and you bank a near-miss bonus. Crash, and you see your place on today's world leaderboard before the screen settles.

No tutorial. No timers begging you to come back. Just a cave, a ship, and one more run.

- One daily cave, identical for every player on Earth
- A ghost of your best run to race
- Live world leaderboard the moment you crash
- Seven power-up coins to juggle
- Eight ships to unlock
- One-hand, one-button controls
- Plays in 15 languages, no tutorial""",
    ios_notes="""- Coins redrawn: shield, ammo and magnet coins now have their own shape and size, readable at a glance and colorblind-safe
- New "+RECORD" moment when you pass your all-time best, with its own sound
- Gentler start: no obstacles before score 25, so your first lesson is the flying
- Rebuilt title screen with quick access to ranks, challenges and ships
- Richer share card, plus fixes to purchases on some devices""",
    play_title="TUNL: Daily Cave Flyer",
    play_short="Hold to fly through a deadly cave. A different one each day, same for everyone.",
    play_full="""TUNL is a one-tap cave flyer with a twist: there is only one cave per day, and the whole world plays it.

HOLD to thrust your ship upward. RELEASE and gravity pulls it down. That is the entire control scheme - and the tunnel around you keeps getting narrower the further you fly.

ONE CAVE A DAY, SHARED BY EVERYONE
Every day TUNL builds a brand new cave from the calendar date, so every player on Earth flies the exact same corridor. At midnight it is gone for good and the next one begins. Your first strong run each day records a ghost: a replay of your ship you can race for the rest of the day.

EASY TO LEARN, HARD TO PUT DOWN
No tutorial, no menus in the way. Collect coins to widen the corridor, grab power-ups to stay alive - shield, magnet, slow-time, bombs and more - and skim the walls for near-miss bonuses. The moment you crash, you see where you land on today's live world leaderboard.

FEATURES
- One daily cave, identical for every player
- Race the ghost of your own best run
- Live daily world leaderboard
- Seven power-up coins with distinct shapes
- Eight unlockable ships
- One-hand, one-button controls
- 15 languages, no tutorial
- Plays offline

Free to play, with optional Remove Ads and Unlock All Ships purchases.""",
    play_notes="""- Coins redrawn: shield, ammo and magnet coins each have their own shape and size now - easy to tell apart at a glance, even colorblind
- New "+RECORD" moment the instant you pass your all-time best, with its own sound
- Gentler start: no obstacles before score 25
- Rebuilt title screen: faster access to ranks, challenges and ships
- Richer share card
- Fixes to purchases on some devices""",
)

# ------------------------------------------------------------------ DE
M["de"] = dict(
    ios_name="TUNL: Tägliche Höhle",
    ios_subtitle="Halten und fliegen, neu am Tag",
    ios_promo=(
        "Die ganze Welt fliegt heute exakt dieselbe Höhle. Morgen ist sie weg "
        "und eine neue kommt. Wie weit kommst du, bevor der Tag vorbei ist?"),
    ios_keywords="einhand,flappy,höhle,tunnel,fliegen,arcade,endlos,geschick,reflex,bestenliste,ein knopf",
    ios_desc="""Halte den Bildschirm und dein Schiff steigt. Loslassen, und die Schwerkraft übernimmt. Das ist das ganze Spiel - und schwerer, als es klingt.

Jeden Tag baut TUNL eine Höhle aus dem Datum. Die ganze Welt fliegt exakt dieselbe Höhle, dann ist sie für immer weg und eine neue kommt. Dein erster guter Lauf am Tag hinterlässt einen Geist. Jag ihn. Schlag ihn.

Der Korridor wird enger, je tiefer du kommst. Sammle Münzen, um ihn zu weiten, und Power-ups zum Überleben: Schild, Magnet, Zeitlupe, Bomben und mehr. Streife den Fels, ohne ihn zu berühren, und du kassierst einen Beinahe-Bonus. Stirb, und du siehst deinen Platz in der heutigen Weltrangliste, bevor der Bildschirm still steht.

Kein Tutorial. Keine Timer, die dich zurückbetteln. Nur eine Höhle, ein Schiff und noch ein Lauf.

- Eine Tageshöhle, identisch für alle auf der Welt
- Ein Geist deines besten Laufs zum Jagen
- Live-Weltrangliste im Moment des Absturzes
- Sieben Power-up-Münzen im Wechselspiel
- Acht Schiffe zum Freischalten
- Einhand-Steuerung mit einem Knopf
- 15 Sprachen, kein Tutorial""",
    ios_notes="""- Münzen neu gezeichnet: Schild-, Munitions- und Magnet-Münze haben jetzt eigene Form und Größe, auf einen Blick erkennbar, auch farbenblind
- Neuer "+REKORD"-Moment, wenn du deine Bestmarke überholst, mit eigenem Sound
- Sanfterer Start: keine Hindernisse vor Punktzahl 25, damit du zuerst das Fliegen lernst
- Neu gebauter Titelscreen mit schnellem Zugriff auf Ränge, Challenges und Schiffe
- Reichere Share-Karte, dazu Fixes für Käufe auf manchen Geräten""",
    play_title="TUNL: Tägliche Höhle",
    play_short="Halten, durch die tödliche Höhle fliegen. Neu am Tag, für alle gleich.",
    play_full="""TUNL ist ein Ein-Tipp-Höhlenflieger mit einem Kniff: Es gibt nur eine Höhle pro Tag, und die ganze Welt spielt sie.

HALTEN, um dein Schiff nach oben zu schieben. LOSLASSEN, und die Schwerkraft zieht es nach unten. Das ist die komplette Steuerung - und der Tunnel um dich herum wird immer enger, je weiter du fliegst.

EINE HÖHLE PRO TAG, FÜR ALLE GLEICH
Jeden Tag baut TUNL eine brandneue Höhle aus dem Kalenderdatum, sodass jeder Spieler auf der Welt exakt denselben Korridor fliegt. Um Mitternacht ist sie endgültig weg und die nächste beginnt. Dein erster starker Lauf am Tag nimmt einen Geist auf: eine Wiederholung deines Schiffs, gegen die du den Rest des Tages antrittst.

LEICHT ZU LERNEN, SCHWER WEGZULEGEN
Kein Tutorial, keine Menüs im Weg. Sammle Münzen, um den Korridor zu weiten, schnapp dir Power-ups zum Überleben - Schild, Magnet, Zeitlupe, Bomben und mehr - und streife die Wände für Beinahe-Boni. Im Moment des Absturzes siehst du, wo du in der heutigen Live-Weltrangliste landest.

FUNKTIONEN
- Eine Tageshöhle, identisch für jeden Spieler
- Jag den Geist deines eigenen besten Laufs
- Live-Weltrangliste, täglich
- Sieben Power-up-Münzen mit eigenen Formen
- Acht freischaltbare Schiffe
- Einhand-Steuerung mit einem Knopf
- 15 Sprachen, kein Tutorial
- Auch offline spielbar

Gratis spielbar, mit optionalen Käufen "Werbung entfernen" und "Alle Schiffe freischalten".""",
    play_notes="""- Münzen neu gezeichnet: Schild-, Munitions- und Magnet-Münze haben jetzt eigene Form und Größe - auf einen Blick zu unterscheiden, auch farbenblind
- Neuer "+REKORD"-Moment in der Sekunde, in der du deine Bestmarke überholst, mit eigenem Sound
- Sanfterer Start: keine Hindernisse vor Punktzahl 25
- Neu gebauter Titelscreen: schnellerer Zugriff auf Ränge, Challenges und Schiffe
- Reichere Share-Karte
- Fixes für Käufe auf manchen Geräten""",
)

# ------------------------------------------------------------------ FR
M["fr"] = dict(
    ios_name="TUNL : grotte du jour",
    ios_subtitle="Maintiens et vole. Neuve/jour",
    ios_promo=(
        "Le monde entier vole aujourd'hui dans la même grotte, au pixel près. "
        "Demain elle disparaît et une autre arrive. Jusqu'où iras-tu avant la fin du jour ?"),
    ios_keywords="une main,flappy,grotte,tunnel,voler,arcade,sans fin,fantôme,classement,réflexe,un bouton",
    ios_desc="""Maintiens l'écran et ton vaisseau monte. Relâche, et la gravité reprend le dessus. C'est tout le jeu - et c'est plus dur que ça en a l'air.

Chaque jour, TUNL construit une grotte à partir de la date. Le monde entier vole dans cette même grotte, puis elle disparaît pour toujours et une nouvelle arrive. Ta première bonne partie du jour laisse un fantôme. Poursuis-le. Bats-le.

Le couloir se resserre à mesure que tu avances. Ramasse des pièces pour l'élargir et des bonus pour survivre : bouclier, aimant, ralenti, bombes et plus encore. Frôle la roche sans la toucher et tu gagnes un bonus de justesse. Écrase-toi, et tu vois ta place au classement mondial du jour avant même que l'écran se stabilise.

Pas de tutoriel. Pas de minuteur qui te supplie de revenir. Juste une grotte, un vaisseau, et une partie de plus.

- Une grotte par jour, identique pour tous
- Un fantôme de ta meilleure partie à courir
- Classement mondial en direct dès que tu t'écrases
- Sept pièces bonus à jongler
- Huit vaisseaux à débloquer
- Commandes à une main, un seul bouton
- 15 langues, aucun tutoriel""",
    ios_notes="""- Pièces redessinées : bouclier, munitions et aimant ont chacun leur forme et leur taille, lisibles d'un coup d'oeil, même daltonien
- Nouveau moment "+RECORD" quand tu dépasses ton meilleur score, avec son propre son
- Départ plus doux : aucun obstacle avant le score 25, pour apprendre d'abord à voler
- Écran titre reconstruit, accès rapide aux rangs, défis et vaisseaux
- Carte de partage enrichie, plus des correctifs d'achats sur certains appareils""",
    play_title="TUNL : grotte du jour",
    play_short="Maintiens et vole dans une grotte mortelle. Une neuve chaque jour, pour tous.",
    play_full="""TUNL est un jeu de vol en grotte à une touche, avec une idée : il n'y a qu'une grotte par jour, et le monde entier y joue.

MAINTIENS pour propulser ton vaisseau vers le haut. RELÂCHE, et la gravité le tire vers le bas. C'est toute la commande - et le tunnel autour de toi se resserre à mesure que tu avances.

UNE GROTTE PAR JOUR, LA MÊME POUR TOUS
Chaque jour, TUNL construit une grotte inédite à partir de la date, si bien que chaque joueur sur Terre vole dans le même couloir exact. À minuit elle disparaît définitivement et la suivante commence. Ta première belle partie du jour enregistre un fantôme : une rediffusion de ton vaisseau contre laquelle tu cours le reste de la journée.

FACILE À PRENDRE EN MAIN, DUR À LÂCHER
Aucun tutoriel, aucun menu en travers. Ramasse des pièces pour élargir le couloir, attrape des bonus pour rester en vie - bouclier, aimant, ralenti, bombes et plus - et frôle les parois pour des bonus de justesse. Dès que tu t'écrases, tu vois ta place au classement mondial du jour, en direct.

CARACTÉRISTIQUES
- Une grotte quotidienne, identique pour chaque joueur
- Cours contre le fantôme de ta meilleure partie
- Classement mondial quotidien en direct
- Sept pièces bonus aux formes distinctes
- Huit vaisseaux à débloquer
- Commandes à une main, un seul bouton
- 15 langues, aucun tutoriel
- Jouable hors ligne

Gratuit, avec les achats facultatifs "Supprimer les pubs" et "Débloquer tous les vaisseaux".""",
    play_notes="""- Pièces redessinées : bouclier, munitions et aimant ont chacun leur forme et leur taille - reconnaissables d'un coup d'oeil, même daltonien
- Nouveau moment "+RECORD" à l'instant où tu dépasses ton meilleur score, avec son propre son
- Départ plus doux : aucun obstacle avant le score 25
- Écran titre reconstruit : accès plus rapide aux rangs, défis et vaisseaux
- Carte de partage enrichie
- Correctifs d'achats sur certains appareils""",
)

# ------------------------------------------------------------------ IT
M["it"] = dict(
    ios_name="TUNL: la grotta del giorno",
    ios_subtitle="Tieni e vola. Nuova al giorno",
    ios_promo=(
        "Oggi il mondo intero vola nella stessa identica grotta. Domani sparirà "
        "e ne arriverà un'altra. Quanto lontano arrivi prima che finisca il giorno?"),
    ios_keywords="una mano,flappy,grotta,tunnel,volare,arcade,senza fine,fantasma,classifica,riflessi,un tasto",
    ios_desc="""Tieni premuto lo schermo e la navicella sale. Lascia, e la gravità prende il sopravvento. È tutto qui - ed è più difficile di quanto sembri.

Ogni giorno TUNL costruisce una grotta a partire dalla data. Il mondo intero vola in quella stessa grotta, poi sparisce per sempre e ne arriva una nuova. La tua prima buona partita del giorno lascia un fantasma. Inseguilo. Battilo.

Il corridoio si stringe più vai a fondo. Raccogli monete per allargarlo e potenziamenti per sopravvivere: scudo, calamita, rallentatore, bombe e altro. Sfiora la roccia senza toccarla e incassi un bonus di precisione. Schianta, e vedi la tua posizione nella classifica mondiale di oggi prima che lo schermo si fermi.

Nessun tutorial. Nessun timer che ti prega di tornare. Solo una grotta, una navicella e un'altra partita.

- Una grotta al giorno, identica per tutti nel mondo
- Un fantasma della tua partita migliore da rincorrere
- Classifica mondiale dal vivo nell'istante in cui ti schianti
- Sette monete potenziamento da gestire
- Otto navicelle da sbloccare
- Comandi a una mano, un solo tasto
- 15 lingue, nessun tutorial""",
    ios_notes="""- Monete ridisegnate: scudo, munizioni e calamita ora hanno forma e dimensione proprie, leggibili a colpo d'occhio, anche per i daltonici
- Nuovo momento "+RECORD" quando superi il tuo primato assoluto, con un suono dedicato
- Avvio più morbido: nessun ostacolo prima del punteggio 25, così impari prima a volare
- Schermata iniziale ricostruita, accesso rapido a classifiche, sfide e navicelle
- Card di condivisione più ricca, più correzioni agli acquisti su alcuni dispositivi""",
    play_title="TUNL: la grotta del giorno",
    play_short="Tieni premuto e vola in una grotta mortale. Nuova ogni giorno, uguale per tutti.",
    play_full="""TUNL è un gioco di volo in grotta con un tocco solo, con un'idea: c'è una sola grotta al giorno, e il mondo intero ci gioca.

TIENI PREMUTO per spingere la navicella verso l'alto. LASCIA, e la gravità la tira giù. Sono tutti i comandi - e il tunnel attorno a te si stringe sempre di più mentre avanzi.

UNA GROTTA AL GIORNO, UGUALE PER TUTTI
Ogni giorno TUNL costruisce una grotta nuova a partire dalla data del calendario, così ogni giocatore sulla Terra vola nello stesso identico corridoio. A mezzanotte sparisce per sempre e comincia la successiva. La tua prima buona partita del giorno registra un fantasma: un replay della tua navicella contro cui corri per il resto della giornata.

FACILE DA IMPARARE, DIFFICILE DA MOLLARE
Nessun tutorial, nessun menu tra i piedi. Raccogli monete per allargare il corridoio, prendi potenziamenti per restare vivo - scudo, calamita, rallentatore, bombe e altro - e sfiora le pareti per bonus di precisione. Nell'istante in cui ti schianti, vedi dove finisci nella classifica mondiale di oggi, dal vivo.

CARATTERISTICHE
- Una grotta giornaliera, identica per ogni giocatore
- Rincorri il fantasma della tua partita migliore
- Classifica mondiale giornaliera dal vivo
- Sette monete potenziamento con forme distinte
- Otto navicelle da sbloccare
- Comandi a una mano, un solo tasto
- 15 lingue, nessun tutorial
- Si gioca anche offline

Gratis, con acquisti facoltativi "Rimuovi pubblicità" e "Sblocca tutte le navicelle".""",
    play_notes="""- Monete ridisegnate: scudo, munizioni e calamita ora hanno forma e dimensione proprie - riconoscibili a colpo d'occhio, anche per i daltonici
- Nuovo momento "+RECORD" nell'istante in cui superi il tuo primato assoluto, con un suono dedicato
- Avvio più morbido: nessun ostacolo prima del punteggio 25
- Schermata iniziale ricostruita: accesso più rapido a classifiche, sfide e navicelle
- Card di condivisione più ricca
- Correzioni agli acquisti su alcuni dispositivi""",
)

# ------------------------------------------------------------------ ES
M["es"] = dict(
    ios_name="TUNL: la cueva del día",
    ios_subtitle="Mantén y vuela. Nueva cada día",
    ios_promo=(
        "Hoy el mundo entero vuela por la misma cueva exacta. Mañana desaparece "
        "y llega otra. ¿Hasta dónde llegas antes de que acabe el día?"),
    ios_keywords="una mano,flappy,cueva,túnel,volar,arcade,sin fin,fantasma,clasificación,reflejos,un botón",
    ios_desc="""Mantén pulsada la pantalla y tu nave sube. Suelta, y la gravedad toma el control. Ese es todo el juego - y es más difícil de lo que parece.

Cada día, TUNL construye una cueva a partir de la fecha. El mundo entero vuela por esa misma cueva, luego desaparece para siempre y llega una nueva. Tu primera buena partida del día deja un fantasma. Persíguelo. Véncelo.

El pasillo se estrecha cuanto más profundo llegas. Recoge monedas para ensancharlo y potenciadores para sobrevivir: escudo, imán, cámara lenta, bombas y más. Roza la roca sin tocarla y te llevas un bono por los pelos. Estréllate, y verás tu puesto en la clasificación mundial de hoy antes de que la pantalla se detenga.

Sin tutorial. Sin temporizadores que te rueguen volver. Solo una cueva, una nave y una partida más.

- Una cueva diaria, idéntica para todo el mundo
- Un fantasma de tu mejor partida al que perseguir
- Clasificación mundial en directo en el instante en que te estrellas
- Siete monedas potenciador que combinar
- Ocho naves por desbloquear
- Controles a una mano, un solo botón
- 15 idiomas, sin tutorial""",
    ios_notes="""- Monedas redibujadas: escudo, munición e imán ahora tienen forma y tamaño propios, legibles de un vistazo, también para daltónicos
- Nuevo momento "+RÉCORD" cuando superas tu mejor marca histórica, con su propio sonido
- Arranque más suave: sin obstáculos antes de la puntuación 25, para aprender primero a volar
- Pantalla de inicio reconstruida, acceso rápido a rangos, retos y naves
- Tarjeta para compartir más rica, y arreglos en las compras en algunos dispositivos""",
    play_title="TUNL: la cueva del día",
    play_short="Mantén pulsado y vuela por una cueva mortal. Nueva cada día, igual para todos.",
    play_full="""TUNL es un juego de vuelo por cuevas de un solo toque, con una idea: solo hay una cueva al día, y el mundo entero la juega.

MANTÉN PULSADO para impulsar tu nave hacia arriba. SUELTA, y la gravedad la arrastra hacia abajo. Ese es todo el control - y el túnel a tu alrededor se estrecha cuanto más avanzas.

UNA CUEVA AL DÍA, LA MISMA PARA TODOS
Cada día TUNL construye una cueva nueva a partir de la fecha del calendario, así que cada jugador del planeta vuela por el mismo pasillo exacto. A medianoche desaparece para siempre y empieza la siguiente. Tu primera buena partida del día graba un fantasma: una repetición de tu nave contra la que compites el resto del día.

FÁCIL DE APRENDER, DIFÍCIL DE SOLTAR
Sin tutorial, sin menús por medio. Recoge monedas para ensanchar el pasillo, coge potenciadores para seguir vivo - escudo, imán, cámara lenta, bombas y más - y roza las paredes para bonos por los pelos. En el instante en que te estrellas, ves dónde caes en la clasificación mundial de hoy, en directo.

CARACTERÍSTICAS
- Una cueva diaria, idéntica para cada jugador
- Persigue el fantasma de tu propia mejor partida
- Clasificación mundial diaria en directo
- Siete monedas potenciador con formas distintas
- Ocho naves desbloqueables
- Controles a una mano, un solo botón
- 15 idiomas, sin tutorial
- Se juega sin conexión

Gratis, con compras opcionales "Quitar anuncios" y "Desbloquear todas las naves".""",
    play_notes="""- Monedas redibujadas: escudo, munición e imán ahora tienen forma y tamaño propios - se distinguen de un vistazo, también para daltónicos
- Nuevo momento "+RÉCORD" en el instante en que superas tu mejor marca histórica, con su propio sonido
- Arranque más suave: sin obstáculos antes de la puntuación 25
- Pantalla de inicio reconstruida: acceso más rápido a rangos, retos y naves
- Tarjeta para compartir más rica
- Arreglos en las compras en algunos dispositivos""",
)

# ------------------------------------------------------------------ PT (Portugal)
M["pt"] = dict(
    ios_name="TUNL: a gruta do dia",
    ios_subtitle="Mantém e voa. Nova a cada dia",
    ios_promo=(
        "Hoje o mundo inteiro voa exatamente pela mesma gruta. Amanhã desaparece "
        "e chega outra. Até onde consegues chegar antes de o dia acabar?"),
    ios_keywords="uma mão,flappy,gruta,túnel,voar,arcade,sem fim,fantasma,classificação,reflexos,um botão",
    ios_desc="""Mantém o ecrã premido e a tua nave sobe. Larga, e a gravidade assume. É o jogo todo - e é mais difícil do que parece.

Todos os dias, o TUNL constrói uma gruta a partir da data. O mundo inteiro voa por essa mesma gruta, depois desaparece para sempre e chega uma nova. A tua primeira boa partida do dia deixa um fantasma. Persegue-o. Vence-o.

O corredor aperta quanto mais fundo vais. Apanha moedas para o alargar e potenciadores para sobreviver: escudo, íman, câmara lenta, bombas e mais. Roça a rocha sem lhe tocar e ganhas um bónus por pouco. Bate, e vês o teu lugar na classificação mundial de hoje antes de o ecrã parar.

Sem tutorial. Sem temporizadores a implorar que voltes. Só uma gruta, uma nave e mais uma partida.

- Uma gruta diária, igual para todos no mundo
- Um fantasma da tua melhor partida para perseguir
- Classificação mundial ao vivo no momento em que bates
- Sete moedas potenciador para gerir
- Oito naves para desbloquear
- Controlos com uma mão, um só botão
- 15 idiomas, sem tutorial""",
    ios_notes="""- Moedas redesenhadas: escudo, munições e íman têm agora forma e tamanho próprios, legíveis num relance, também para daltónicos
- Novo momento "+RECORDE" quando passas a tua melhor marca de sempre, com som próprio
- Arranque mais suave: sem obstáculos antes da pontuação 25, para aprenderes primeiro a voar
- Ecrã inicial reconstruído, acesso rápido a categorias, desafios e naves
- Cartão de partilha mais rico, mais correções nas compras em alguns dispositivos""",
    play_title="TUNL: a gruta do dia",
    play_short="Mantém premido e voa por uma gruta mortal. Nova a cada dia, igual para todos.",
    play_full="""O TUNL é um jogo de voo por grutas com um só toque, com uma ideia: há apenas uma gruta por dia, e o mundo inteiro joga-a.

MANTÉM PREMIDO para impulsionar a tua nave para cima. LARGA, e a gravidade puxa-a para baixo. É o controlo todo - e o túnel à tua volta aperta cada vez mais à medida que avanças.

UMA GRUTA POR DIA, IGUAL PARA TODOS
Todos os dias o TUNL constrói uma gruta nova a partir da data do calendário, por isso cada jogador do planeta voa pelo mesmo corredor exato. À meia-noite desaparece de vez e começa a seguinte. A tua primeira boa partida do dia grava um fantasma: uma repetição da tua nave contra a qual competes o resto do dia.

FÁCIL DE APRENDER, DIFÍCIL DE LARGAR
Sem tutorial, sem menus a atrapalhar. Apanha moedas para alargar o corredor, agarra potenciadores para te manteres vivo - escudo, íman, câmara lenta, bombas e mais - e roça as paredes para bónus por pouco. No momento em que bates, vês onde cais na classificação mundial de hoje, ao vivo.

FUNCIONALIDADES
- Uma gruta diária, igual para cada jogador
- Persegue o fantasma da tua própria melhor partida
- Classificação mundial diária ao vivo
- Sete moedas potenciador com formas distintas
- Oito naves para desbloquear
- Controlos com uma mão, um só botão
- 15 idiomas, sem tutorial
- Joga-se offline

Gratuito, com compras opcionais "Remover anúncios" e "Desbloquear todas as naves".""",
    play_notes="""- Moedas redesenhadas: escudo, munições e íman têm agora forma e tamanho próprios - distinguem-se num relance, também para daltónicos
- Novo momento "+RECORDE" no instante em que passas a tua melhor marca de sempre, com som próprio
- Arranque mais suave: sem obstáculos antes da pontuação 25
- Ecrã inicial reconstruído: acesso mais rápido a categorias, desafios e naves
- Cartão de partilha mais rico
- Correções nas compras em alguns dispositivos""",
)

# ------------------------------------------------------------------ PT-BR (Phase 4: Brazil-tailored, not a translation)
# Angles for the Brazilian market: free / light / plays without wi-fi (data + storage
# sensitive), world ranking + beating friends (competitive mobile culture), the daily
# shared cave as a WhatsApp-shareable ritual. Casual BR register ("segura", "vicia",
# "manda pros amigos"), not European-Portuguese phrasing.
M["pt-BR"] = dict(
    ios_name="TUNL: a caverna do dia",
    ios_subtitle="Segura, sobe. Nova todo dia",
    ios_promo=(
        "Todo dia uma caverna nova, a mesma pro mundo inteiro. Grátis, leve e joga "
        "sem internet. Onde você fica no ranking mundial de hoje?"),
    ios_keywords="um toque,flappy,caverna,tunel,voar,arcade,sem fim,fantasma,ranking,reflexo,offline,leve",
    ios_desc="""Segura a tela e a nave sobe. Solta e a gravidade puxa pra baixo. É isso, o jogo inteiro. E vicia.

Todo dia o TUNL monta uma caverna a partir da data. O mundo inteiro voa nessa mesma caverna, aí ela some pra sempre e entra outra. Sua primeira partida boa do dia vira um fantasma. Corre atrás. Passa ele.

Quanto mais fundo, mais estreito fica o corredor. Pega moeda pra alargar e power-up pra aguentar: escudo, ímã, câmera lenta, bomba e mais. Raspa na pedra sem encostar e leva bônus de raspão. Bateu? Você já vê sua posição no ranking mundial de hoje antes da tela parar.

Sem tutorial. Sem cronômetro te chamando de volta. Só a caverna, a nave e mais uma.

- Grátis, leve e roda sem internet
- Uma caverna por dia, igual pro mundo todo, boa pra mandar no grupo
- Ranking mundial na hora que você bate
- Fantasma da sua melhor partida pra encarar
- Sete power-ups pra fazer malabarismo
- Oito naves pra desbloquear
- Uma mão, um toque, sem tutorial""",
    ios_notes="""- Moedas redesenhadas: escudo, munição e ímã agora têm forma e tamanho próprios, dá pra bater o olho e saber qual é, mesmo pra daltônicos
- Novo momento "+RECORDE" na hora que você passa seu melhor de todos os tempos, com som próprio
- Começo mais tranquilo: nada de obstáculo antes dos 25 pontos, pra você pegar o jeito de voar
- Tela inicial reconstruída, acesso rápido a ranking, desafios e naves
- Cartão de compartilhar mais caprichado e correções de compra em alguns aparelhos""",
    play_title="TUNL: a caverna do dia",
    play_short="Segura pra subir e voa por uma caverna mortal. Nova todo dia, a mesma pro mundo.",
    play_full="""TUNL é um jogo de voar em caverna com um toque só. Grátis, leve e joga sem internet. E tem uma ideia diferente: só existe uma caverna por dia, e o mundo inteiro joga ela.

SEGURA pra empurrar a nave pra cima. SOLTA e a gravidade puxa pra baixo. É o controle inteiro. E o túnel em volta vai ficando mais apertado quanto mais longe você vai.

UMA CAVERNA POR DIA, IGUAL PRO MUNDO TODO
Todo dia o TUNL monta uma caverna nova a partir da data, então todo mundo no planeta voa exatamente no mesmo corredor. À meia-noite ela some de vez e começa a próxima. Sua primeira partida boa do dia grava um fantasma: um replay da sua nave pra você encarar o resto do dia. Bateu um recorde? Manda o cartão no grupo do zap.

FÁCIL DE PEGAR, DIFÍCIL DE LARGAR
Sem tutorial, sem menu no caminho. Pega moeda pra alargar o corredor, pega power-up pra se segurar - escudo, ímã, câmera lenta, bomba e mais - e raspa nas paredes pra ganhar bônus de raspão. Na hora que você bate, já vê onde caiu no ranking mundial de hoje, ao vivo.

O QUE TEM
- Grátis, leve e roda sem internet
- Uma caverna por dia, igual pra todo jogador
- Ranking mundial diário ao vivo
- Fantasma da sua própria melhor partida
- Sete power-ups com formatos diferentes
- Oito naves pra desbloquear
- Uma mão, um toque, sem tutorial
- 15 idiomas

Compras opcionais: "Remover anúncios" e "Desbloquear todas as naves".""",
    play_notes="""- Moedas redesenhadas: escudo, munição e ímã agora têm forma e tamanho próprios, dá pra bater o olho e saber qual é, mesmo pra daltônicos
- Novo momento "+RECORDE" na hora que você passa seu melhor de todos os tempos, com som próprio
- Começo mais tranquilo: nada de obstáculo antes dos 25 pontos
- Tela inicial reconstruída: acesso mais rápido a ranking, desafios e naves
- Cartão de compartilhar mais caprichado
- Correções de compra em alguns aparelhos""",
)

# ------------------------------------------------------------------ JA
M["ja"] = dict(
    ios_name="TUNL 毎日の洞窟フライト",
    ios_subtitle="押して飛ぶ。毎日新しい洞窟。",
    ios_promo=(
        "今日は世界中が全く同じ洞窟を飛ぶ。明日には消えて、新しい洞窟に変わる。"
        "その日が終わる前に、どこまで行ける？"),
    ios_keywords="ワンタップ,片手,洞窟,トンネル,フライト,アーケード,エンドレス,ゴースト,ランキング,反射神経,ボタン一つ",
    ios_desc="""画面を押すと機体が上がる。離すと重力が引き戻す。操作はそれだけ。でも見た目より難しい。

TUNLは毎日、日付から洞窟を1つ生成する。世界中が全く同じ洞窟を飛び、その洞窟は二度と戻らず、次の洞窟に変わる。その日の最初の良い記録はゴーストとして残る。追いかけて、抜き去ろう。

奥へ進むほど通路は狭くなる。コインを集めて通路を広げ、パワーアップで生き延びよう。シールド、マグネット、スロー、ボム、その他いろいろ。壁ギリギリを触れずにかすめるとニアミスボーナス。墜落すると、画面が止まる前に今日の世界ランキングでの順位が見える。

チュートリアルなし。戻ってこいと急かすタイマーもなし。あるのは洞窟と機体、そしてもう1回。

- 毎日1つの洞窟、世界中の全プレイヤーで同じ
- 自己ベストのゴーストを追走
- 墜落した瞬間に見えるライブ世界ランキング
- 7種類のパワーアップコイン
- 8機の機体をアンロック
- 片手・ボタン一つの操作
- 15言語対応、チュートリアルなし""",
    ios_notes="""- コインを描き直し:シールド・弾薬・マグネットのコインが独自の形とサイズになり、一目で分かる。色覚特性があっても見分けやすい
- 自己ベストを超えた瞬間の新演出「+RECORD」、専用サウンド付き
- 立ち上がりを緩やかに:スコア25まで障害物なし。まず飛ぶ感覚を覚えられる
- タイトル画面を刷新。ランク、チャレンジ、機体にすばやくアクセス
- シェアカードを強化、一部端末での購入の不具合も修正""",
    play_title="TUNL 毎日の洞窟フライト",
    play_short="押して飛び、死の洞窟を抜ける。洞窟は毎日新しく、世界中で同じ。",
    play_full="""TUNLはワンタップの洞窟フライトゲーム。ひねりが一つ:洞窟は1日に1つだけで、世界中がそれを遊ぶ。

長押しで機体を上に押し上げる。離すと重力が下に引く。操作はこれだけ。そして周囲のトンネルは、進むほど狭くなっていく。

1日1つの洞窟、世界中で同じ
TUNLは毎日、カレンダーの日付から新しい洞窟を生成する。だから地球上のどのプレイヤーも全く同じ通路を飛ぶ。深夜になると洞窟は完全に消え、次の洞窟が始まる。その日の最初の良い記録はゴーストになり、残りの一日ずっとそれと競える。

覚えるのは簡単、やめるのは難しい
チュートリアルなし、邪魔なメニューなし。コインを集めて通路を広げ、パワーアップで生き延びる。シールド、マグネット、スロー、ボム、その他いろいろ。壁をかすめてニアミスボーナス。墜落した瞬間、今日のライブ世界ランキングでの着地点が見える。

特長
- 毎日の洞窟、全プレイヤーで同一
- 自分のベスト走行のゴーストと競争
- 毎日のライブ世界ランキング
- 形が異なる7種類のパワーアップコイン
- アンロック可能な8機の機体
- 片手・ボタン一つの操作
- 15言語、チュートリアルなし
- オフラインでプレイ可能

基本プレイ無料。「広告を非表示」「全機体アンロック」の購入は任意。""",
    play_notes="""- コインを描き直し:シールド・弾薬・マグネットのコインが独自の形とサイズになり、一目で見分けられる。色覚特性があっても分かりやすい
- 自己ベストを超えた瞬間の新演出「+RECORD」、専用サウンド付き
- 立ち上がりを緩やかに:スコア25まで障害物なし
- タイトル画面を刷新:ランク、チャレンジ、機体へのアクセスが速く
- シェアカードを強化
- 一部端末での購入の不具合を修正""",
)

# ------------------------------------------------------------------ KO
M["ko"] = dict(
    ios_name="TUNL: 매일의 동굴 비행",
    ios_subtitle="누르면 난다. 매일 새 동굴.",
    ios_promo=(
        "오늘은 전 세계가 똑같은 동굴을 난다. 내일이면 사라지고 새 동굴이 온다. "
        "하루가 끝나기 전에 얼마나 갈 수 있을까?"),
    ios_keywords="원터치,한손,동굴,터널,비행,아케이드,엔드리스,고스트,순위표,반사신경,버튼 하나",
    ios_desc="""화면을 누르면 우주선이 올라가고, 놓으면 중력이 끌어내린다. 조작은 이게 전부다. 그런데 보기보다 어렵다.

TUNL은 매일 날짜로 동굴 하나를 만든다. 전 세계가 똑같은 그 동굴을 날고, 그 동굴은 영영 사라지고 다음 동굴이 온다. 그날의 첫 좋은 기록은 고스트로 남는다. 쫓아가서, 앞질러라.

깊이 들어갈수록 통로는 좁아진다. 코인을 모아 통로를 넓히고, 파워업으로 살아남아라. 방패, 자석, 슬로우, 폭탄 등. 벽을 건드리지 않고 스치면 아슬아슬 보너스. 추락하면 화면이 멈추기도 전에 오늘의 세계 순위가 보인다.

튜토리얼 없음. 돌아오라고 조르는 타이머 없음. 그냥 동굴, 우주선, 그리고 한 판 더.

- 매일 하나의 동굴, 전 세계 모든 플레이어가 동일
- 자기 최고 기록의 고스트와 경주
- 추락하는 순간 뜨는 실시간 세계 순위표
- 다뤄야 할 7가지 파워업 코인
- 잠금 해제 가능한 우주선 8대
- 한 손, 버튼 하나 조작
- 15개 언어, 튜토리얼 없음""",
    ios_notes="""- 코인 새로 그림: 방패, 탄약, 자석 코인이 각자 고유한 모양과 크기를 갖게 되어 한눈에 구분 가능, 색약이어도 알아보기 쉬움
- 역대 최고 기록을 넘는 순간 새 연출 "+RECORD", 전용 사운드 포함
- 더 부드러운 시작: 점수 25까지 장애물 없음, 먼저 나는 법부터 익히도록
- 타이틀 화면 재구성, 순위/도전 과제/우주선에 빠르게 접근
- 더 풍성해진 공유 카드, 일부 기기의 구매 문제도 수정""",
    play_title="TUNL: 매일의 동굴 비행",
    play_short="누른 채로 치명적인 동굴을 날아라. 매일 새 동굴, 전 세계가 동일.",
    play_full="""TUNL은 원터치 동굴 비행 게임입니다. 한 가지 반전이 있습니다: 동굴은 하루에 하나뿐이고, 전 세계가 그것을 플레이합니다.

길게 눌러 우주선을 위로 밀어 올리고, 놓으면 중력이 아래로 당깁니다. 조작은 이게 전부입니다. 그리고 주변 터널은 나아갈수록 계속 좁아집니다.

하루 한 동굴, 전 세계가 동일
TUNL은 매일 달력 날짜로 새 동굴을 만듭니다. 그래서 지구상의 모든 플레이어가 똑같은 통로를 납니다. 자정이 되면 동굴은 완전히 사라지고 다음 동굴이 시작됩니다. 그날의 첫 좋은 기록은 고스트로 저장되어, 남은 하루 동안 그것과 경쟁할 수 있습니다.

배우기 쉽고, 놓기 어렵다
튜토리얼 없음, 거슬리는 메뉴 없음. 코인을 모아 통로를 넓히고, 파워업으로 살아남으세요 - 방패, 자석, 슬로우, 폭탄 등. 벽을 스쳐 아슬아슬 보너스를 챙기세요. 추락하는 순간, 오늘의 실시간 세계 순위에서 어디에 안착했는지 보입니다.

특징
- 매일의 동굴, 모든 플레이어가 동일
- 자신의 최고 기록 고스트와 경주
- 매일의 실시간 세계 순위표
- 모양이 다른 7가지 파워업 코인
- 잠금 해제 가능한 우주선 8대
- 한 손, 버튼 하나 조작
- 15개 언어, 튜토리얼 없음
- 오프라인 플레이 가능

무료로 플레이, "광고 제거"와 "모든 우주선 잠금 해제"는 선택 구매입니다.""",
    play_notes="""- 코인 새로 그림: 방패, 탄약, 자석 코인이 각자 고유한 모양과 크기를 갖게 되어 한눈에 구분, 색약이어도 알아보기 쉬움
- 역대 최고 기록을 넘는 순간 새 연출 "+RECORD", 전용 사운드 포함
- 더 부드러운 시작: 점수 25까지 장애물 없음
- 타이틀 화면 재구성: 순위, 도전 과제, 우주선 접근이 더 빠름
- 더 풍성해진 공유 카드
- 일부 기기의 구매 문제 수정""",
)

# ------------------------------------------------------------------ ZH (Traditional)
M["zh"] = dict(
    ios_name="TUNL：每日洞穴飛行",
    ios_subtitle="按住起飛，每天全新洞穴",
    ios_promo=(
        "今天全世界都飛同一個洞穴，一模一樣。明天它就消失，換成新的。"
        "在這一天結束前，你能飛多遠？"),
    ios_keywords="一鍵,單手,洞穴,隧道,飛行,街機,無盡,幽靈,排行榜,反應,單鍵操作",
    ios_desc="""按住螢幕，飛船就上升；放手，重力接手。整個遊戲就這樣，但比看起來難。

TUNL 每天用日期生成一個洞穴。全世界都飛這個一模一樣的洞穴，然後它永遠消失，換成下一個。你當天第一次好成績會留下一個幽靈。追上它，超過它。

飛得越深，通道越窄。收集金幣把它撐寬，拿道具活下去：護盾、磁鐵、慢動作、炸彈等等。貼著岩壁掠過又不碰到，就能拿到擦身而過獎勵。撞毀時，畫面還沒停，你就看到自己在今天世界排行榜上的名次。

沒有教學。沒有催你回來的計時器。只有一個洞穴、一艘飛船，還有再來一局。

- 每日一個洞穴，全世界玩家完全相同
- 一個你最佳成績的幽靈可以追
- 撞毀當下就顯示的即時世界排行榜
- 七種道具金幣要兼顧
- 八艘飛船可解鎖
- 單手、單鍵操作
- 支援 15 種語言，沒有教學""",
    ios_notes="""- 金幣重繪:護盾、彈藥、磁鐵金幣現在各有自己的形狀和大小,一眼就能分辨,色盲也適用
- 超過歷史最佳成績的瞬間有全新的「+RECORD」演出,配專屬音效
- 開場更平緩:分數 25 之前沒有障礙物,讓你先學會飛
- 重建標題畫面,快速前往排名、挑戰和飛船
- 更豐富的分享卡,並修正部分裝置上的購買問題""",
    play_title="TUNL：每日洞穴飛行",
    play_short="按住起飛，穿越致命洞穴。每天一個新洞穴，全世界都一樣。",
    play_full="""TUNL 是一款一鍵操作的洞穴飛行遊戲，有個特別之處:每天只有一個洞穴，而且全世界都在玩它。

按住讓飛船向上推進，放開讓重力把它往下拉。這就是全部操作，而你身邊的隧道會隨著你飛得越遠而越來越窄。

每天一個洞穴，全世界都一樣
TUNL 每天用日曆日期生成一個全新洞穴，所以地球上每個玩家飛的都是同一條通道。到了午夜，它就徹底消失，下一個開始。你當天第一次好成績會錄下一個幽靈:你飛船的重播，接下來一整天都能跟它較勁。

好上手，難放下
沒有教學，沒有礙事的選單。收集金幣撐寬通道，拿道具保命 - 護盾、磁鐵、慢動作、炸彈等等 - 貼牆掠過拿擦身獎勵。撞毀的瞬間，你就看到自己落在今天即時世界排行榜的哪個位置。

特色
- 每日洞穴，每位玩家完全相同
- 追逐你自己最佳成績的幽靈
- 每日即時世界排行榜
- 七種形狀各異的道具金幣
- 八艘可解鎖飛船
- 單手、單鍵操作
- 15 種語言，沒有教學
- 可離線遊玩

免費遊玩，另有選購項目「移除廣告」和「解鎖所有飛船」。""",
    play_notes="""- 金幣重繪:護盾、彈藥、磁鐵金幣現在各有自己的形狀和大小,一眼就能分辨,色盲也適用
- 超過歷史最佳成績的瞬間有全新的「+RECORD」演出,配專屬音效
- 開場更平緩:分數 25 之前沒有障礙物
- 重建標題畫面:更快前往排名、挑戰和飛船
- 更豐富的分享卡
- 修正部分裝置上的購買問題""",
)

# ------------------------------------------------------------------ RU
M["ru"] = dict(
    ios_name="TUNL: пещера дня",
    ios_subtitle="Держи. Лети. Новая каждый день",
    ios_promo=(
        "Сегодня весь мир летит через одну и ту же пещеру, до пикселя. Завтра она "
        "исчезнет, и придёт новая. Как далеко долетишь, пока день не кончился?"),
    ios_keywords="одно касание,одной рукой,пещера,туннель,полёт,аркада,бесконечная,призрак,таблица лидеров,реакция",
    ios_desc="""Держи палец на экране - корабль набирает высоту. Отпусти - гравитация тянет вниз. Это всё управление, и оно сложнее, чем кажется.

Каждый день TUNL строит пещеру из даты. Весь мир летит через эту самую пещеру, потом она исчезает навсегда, и приходит новая. Твой первый хороший забег за день оставляет призрака. Догони его. Обгони.

Коридор сужается по мере погружения. Собирай монеты, чтобы расширить его, и бонусы, чтобы выжить: щит, магнит, замедление времени, бомбы и другое. Проскользни у самой скалы, не задев её, и получишь бонус за риск. Разбился - и видишь своё место в сегодняшней мировой таблице лидеров ещё до того, как экран замрёт.

Ни обучения. Ни таймеров, умоляющих вернуться. Только пещера, корабль и ещё один заход.

- Одна пещера в день, одинаковая для всех на Земле
- Призрак твоего лучшего забега, за которым можно гнаться
- Живая мировая таблица лидеров в момент крушения
- Семь бонусных монет, которыми надо жонглировать
- Восемь кораблей для разблокировки
- Управление одной рукой, одной кнопкой
- 15 языков, без обучения""",
    ios_notes="""- Монеты перерисованы: щит, патроны и магнит теперь со своей формой и размером, читаются с одного взгляда, в том числе при дальтонизме
- Новый момент "+РЕКОРД", когда обходишь свой абсолютный рекорд, со своим звуком
- Мягче старт: никаких препятствий до 25 очков, чтобы сперва освоить полёт
- Перестроенный титульный экран с быстрым доступом к рангам, испытаниям и кораблям
- Более насыщенная карточка для шаринга, плюс исправления покупок на части устройств""",
    play_title="TUNL: пещера дня",
    play_short="Держи и лети через смертельную пещеру. Каждый день новая, одна на весь мир.",
    play_full="""TUNL - это полёт через пещеру в одно касание, с одной особенностью: пещера всего одна в день, и в неё играет весь мир.

ДЕРЖИ, чтобы толкать корабль вверх. ОТПУСТИ - и гравитация тянет вниз. Это всё управление, а туннель вокруг тебя сужается тем сильнее, чем дальше ты летишь.

ОДНА ПЕЩЕРА В ДЕНЬ, ОДНА НА ВСЕХ
Каждый день TUNL строит новую пещеру из даты календаря, так что каждый игрок на Земле летит через один и тот же коридор. В полночь она исчезает навсегда, и начинается следующая. Твой первый сильный забег за день записывает призрака: повтор твоего корабля, с которым ты соревнуешься весь оставшийся день.

ЛЕГКО НАЧАТЬ, ТРУДНО ОСТАНОВИТЬСЯ
Ни обучения, ни меню на пути. Собирай монеты, чтобы расширить коридор, бери бонусы, чтобы остаться в живых - щит, магнит, замедление времени, бомбы и другое - и проскальзывай у стен ради бонусов за риск. В момент крушения ты видишь, на каком месте оказался в сегодняшней живой мировой таблице лидеров.

ОСОБЕННОСТИ
- Ежедневная пещера, одинаковая для каждого игрока
- Гонка с призраком твоего лучшего забега
- Живая ежедневная мировая таблица лидеров
- Семь бонусных монет с разными формами
- Восемь кораблей для разблокировки
- Управление одной рукой, одной кнопкой
- 15 языков, без обучения
- Работает офлайн

Бесплатно, с необязательными покупками "Убрать рекламу" и "Открыть все корабли".""",
    play_notes="""- Монеты перерисованы: щит, патроны и магнит теперь со своей формой и размером - различимы с одного взгляда, в том числе при дальтонизме
- Новый момент "+РЕКОРД" в ту секунду, когда обходишь свой абсолютный рекорд, со своим звуком
- Мягче старт: никаких препятствий до 25 очков
- Перестроенный титульный экран: быстрее доступ к рангам, испытаниям и кораблям
- Более насыщенная карточка для шаринга
- Исправления покупок на части устройств""",
)

# ------------------------------------------------------------------ AR
M["ar"] = dict(
    ios_name="TUNL: كهف كل يوم",
    ios_subtitle="اضغط لتطير. كهف جديد كل يوم.",
    ios_promo=(
        "اليوم يطير العالم كله عبر الكهف نفسه تماما. غدا يختفي ويأتي كهف جديد. "
        "إلى أي مدى تصل قبل أن ينتهي اليوم؟"),
    ios_keywords="لمسة واحدة,يد واحدة,كهف,نفق,طيران,أركيد,لانهائي,شبح,لوحة المتصدرين,رد الفعل,زر واحد",
    ios_desc="""اضغط على الشاشة فترتفع مركبتك. ارفع إصبعك فتتولى الجاذبية الأمر. هذه هي اللعبة كلها، وهي أصعب مما تبدو.

كل يوم يبني TUNL كهفا من التاريخ. العالم كله يطير عبر هذا الكهف نفسه، ثم يختفي إلى الأبد ويأتي كهف جديد. أول جولة جيدة لك في اليوم تترك شبحا. طارده. تجاوزه.

يضيق الممر كلما توغلت. اجمع العملات لتوسيعه، والقدرات للبقاء حيا: درع، مغناطيس، إبطاء الزمن، قنابل وغيرها. لامس الصخر دون أن تمسه فتكسب مكافأة النجاة بشعرة. اصطدم، فترى ترتيبك على لوحة متصدري العالم لهذا اليوم قبل أن تستقر الشاشة.

بلا شرح تعليمي. بلا مؤقتات تتوسل إليك أن تعود. فقط كهف ومركبة وجولة أخرى.

- كهف واحد كل يوم، متطابق لكل لاعب على الأرض
- شبح لأفضل جولاتك تطارده
- لوحة متصدري العالم مباشرة لحظة اصطدامك
- سبع عملات قدرات توازن بينها
- ثماني مركبات لفتحها
- تحكم بيد واحدة وزر واحد
- 15 لغة، بلا شرح تعليمي""",
    ios_notes="""- إعادة رسم العملات: عملات الدرع والذخيرة والمغناطيس صار لكل منها شكل وحجم خاص، تميزها بلمحة، وحتى لعمى الألوان
- لحظة "+RECORD" جديدة حين تتجاوز أفضل رقم لك على الإطلاق، بصوت خاص بها
- بداية أهدأ: لا عوائق قبل النتيجة 25، لتتعلم الطيران أولا
- شاشة عنوان معاد بناؤها، وصول سريع إلى الرتب والتحديات والمركبات
- بطاقة مشاركة أغنى، مع إصلاحات لعمليات الشراء على بعض الأجهزة""",
    play_title="TUNL: كهف كل يوم",
    play_short="اضغط مطولا لتطير عبر كهف قاتل. كهف جديد كل يوم، هو نفسه للجميع.",
    play_full="""TUNL لعبة طيران في كهف بلمسة واحدة، بفكرة مميزة: هناك كهف واحد فقط كل يوم، والعالم كله يلعبه.

اضغط مطولا لدفع مركبتك إلى الأعلى. ارفع إصبعك فتسحبها الجاذبية إلى الأسفل. هذا هو التحكم بأكمله، والنفق من حولك يضيق أكثر كلما توغلت.

كهف واحد كل يوم، هو نفسه للجميع
كل يوم يبني TUNL كهفا جديدا من تاريخ التقويم، فيطير كل لاعب على الأرض عبر الممر نفسه تماما. عند منتصف الليل يختفي نهائيا ويبدأ التالي. أول جولة قوية لك في اليوم تسجل شبحا: إعادة لمركبتك تسابقها بقية اليوم.

سهلة التعلم، يصعب تركها
بلا شرح تعليمي، بلا قوائم تعترض طريقك. اجمع العملات لتوسيع الممر، والتقط القدرات للبقاء حيا - درع، مغناطيس، إبطاء الزمن، قنابل وغيرها - ولامس الجدران لمكافآت النجاة بشعرة. لحظة اصطدامك، ترى أين حللت على لوحة متصدري العالم لهذا اليوم، مباشرة.

الميزات
- كهف يومي، متطابق لكل لاعب
- سابق شبح أفضل جولاتك
- لوحة متصدري العالم اليومية المباشرة
- سبع عملات قدرات بأشكال مختلفة
- ثماني مركبات لفتحها
- تحكم بيد واحدة وزر واحد
- 15 لغة، بلا شرح تعليمي
- تعمل دون اتصال

مجانية، مع مشتريات اختيارية "إزالة الإعلانات" و"فتح كل المركبات".""",
    play_notes="""- إعادة رسم العملات: عملات الدرع والذخيرة والمغناطيس صار لكل منها شكل وحجم خاص - تميزها بلمحة، وحتى لعمى الألوان
- لحظة "+RECORD" جديدة في اللحظة التي تتجاوز فيها أفضل رقم لك على الإطلاق، بصوت خاص بها
- بداية أهدأ: لا عوائق قبل النتيجة 25
- شاشة عنوان معاد بناؤها: وصول أسرع إلى الرتب والتحديات والمركبات
- بطاقة مشاركة أغنى
- إصلاحات لعمليات الشراء على بعض الأجهزة""",
)

# ------------------------------------------------------------------ TR
M["tr"] = dict(
    ios_name="TUNL: günün mağarası",
    ios_subtitle="Basılı tut ve uç. Her gün yeni",
    ios_promo=(
        "Bugün tüm dünya aynı mağarada uçuyor, pikseli pikseline. Yarın yok olacak "
        "ve yenisi gelecek. Gün bitmeden ne kadar ilerleyebilirsin?"),
    ios_keywords="tek dokunuş,tek el,mağara,tünel,uçuş,arcade,sonsuz,hayalet,sıralama,refleks,tek tuş",
    ios_desc="""Ekranı basılı tut, geminin yükselir. Bırak, yer çekimi devreye girer. Oyunun tamamı bu ve göründüğünden zor.

TUNL her gün tarihten bir mağara inşa eder. Tüm dünya aynı mağarada uçar, sonra o mağara sonsuza dek kaybolur ve yenisi gelir. Günün ilk iyi koşun bir hayalet bırakır. Peşine düş. Geç onu.

Derinlere indikçe koridor daralır. Genişletmek için para topla, hayatta kalmak için güç artırıcılar al: kalkan, mıknatıs, yavaşlatma, bombalar ve dahası. Kayaya dokunmadan sıyırıp geçersen kıl payı bonusu kazanırsın. Çarpıp öldüğünde, ekran durmadan bugünün dünya sıralamasındaki yerini görürsün.

Eğitim yok. Geri dön diye yalvaran zamanlayıcılar yok. Sadece bir mağara, bir gemi ve bir tur daha.

- Günde bir mağara, dünyadaki herkes için aynı
- Kovalayacağın, en iyi koşunun bir hayaleti
- Çarptığın anda canlı dünya sıralaması
- İdare edeceğin yedi güç artırıcı para
- Açılacak sekiz gemi
- Tek el, tek tuş kontrol
- 15 dil, eğitim yok""",
    ios_notes="""- Paralar yeniden çizildi: kalkan, cephane ve mıknatıs paralarının artık kendi şekli ve boyutu var, bir bakışta okunuyor, renk körlüğünde bile
- En iyi skorunu geçtiğin anda yeni "+RECORD" anı, kendine ait sesle
- Daha yumuşak başlangıç: 25 puana kadar engel yok, önce uçmayı öğrenesin diye
- Yeniden yapılan başlık ekranı, sıralamalara, mücadelelere ve gemilere hızlı erişim
- Daha zengin paylaşım kartı, ayrıca bazı cihazlarda satın alma düzeltmeleri""",
    play_title="TUNL: günün mağarası",
    play_short="Basılı tut ve ölümcül bir mağarada uç. Her gün yenisi, herkes için aynı.",
    play_full="""TUNL tek dokunuşlu bir mağara uçuş oyunu, bir püf noktasıyla: günde tek bir mağara var ve tüm dünya onu oynuyor.

Gemiyi yukarı itmek için BASILI TUT. BIRAK, yer çekimi aşağı çeker. Kontrolün tamamı bu ve etrafındaki tünel ilerledikçe giderek daralır.

GÜNDE BİR MAĞARA, HERKES İÇİN AYNI
TUNL her gün takvim tarihinden yepyeni bir mağara inşa eder, böylece dünyadaki her oyuncu aynı koridorda uçar. Gece yarısı tamamen kaybolur ve bir sonraki başlar. Günün ilk iyi koşun bir hayalet kaydeder: günün geri kalanında yarıştığın, geminin bir tekrarı.

ÖĞRENMESİ KOLAY, BIRAKMASI ZOR
Eğitim yok, yolunu kesen menü yok. Koridoru genişletmek için para topla, hayatta kalmak için güç artırıcılar al - kalkan, mıknatıs, yavaşlatma, bombalar ve dahası - ve kıl payı bonusları için duvarları sıyır. Çarptığın anda, bugünün canlı dünya sıralamasında nereye düştüğünü görürsün.

ÖZELLİKLER
- Günlük mağara, her oyuncu için aynı
- Kendi en iyi koşunun hayaletiyle yarış
- Canlı günlük dünya sıralaması
- Farklı şekillerde yedi güç artırıcı para
- Açılabilir sekiz gemi
- Tek el, tek tuş kontrol
- 15 dil, eğitim yok
- Çevrimdışı oynanır

Ücretsiz, isteğe bağlı "Reklamları Kaldır" ve "Tüm Gemileri Aç" satın alımlarıyla.""",
    play_notes="""- Paralar yeniden çizildi: kalkan, cephane ve mıknatıs paralarının artık kendi şekli ve boyutu var - bir bakışta ayırt ediliyor, renk körlüğünde bile
- En iyi skorunu geçtiğin anda yeni "+RECORD" anı, kendine ait sesle
- Daha yumuşak başlangıç: 25 puana kadar engel yok
- Yeniden yapılan başlık ekranı: sıralamalara, mücadelelere ve gemilere daha hızlı erişim
- Daha zengin paylaşım kartı
- Bazı cihazlarda satın alma düzeltmeleri""",
)

# ------------------------------------------------------------------ ID (Indonesian uses no diacritics)
M["id"] = dict(
    ios_name="TUNL: gua harian",
    ios_subtitle="Tahan, terbang. Baru tiap hari",
    ios_promo=(
        "Hari ini seluruh dunia terbang di gua yang sama persis. Besok gua itu "
        "hilang dan yang baru datang. Sejauh apa kamu bisa sebelum hari berakhir?"),
    ios_keywords="satu ketuk,satu tangan,gua,terowongan,terbang,arcade,tanpa akhir,hantu,papan peringkat,refleks",
    ios_desc="""Tahan layar dan pesawatmu naik. Lepas, dan gravitasi mengambil alih. Itu seluruh permainannya, dan lebih sulit dari kelihatannya.

Setiap hari, TUNL membangun satu gua dari tanggal. Seluruh dunia terbang di gua yang sama persis, lalu gua itu hilang selamanya dan yang baru datang. Larian bagus pertamamu hari itu meninggalkan hantu. Kejar. Kalahkan.

Lorong menyempit makin dalam kamu terbang. Kumpulkan koin untuk melebarkannya dan power-up untuk bertahan: perisai, magnet, gerak lambat, bom, dan lainnya. Serempet batu tanpa menyentuhnya dan kamu dapat bonus nyaris kena. Menabrak, dan kamu lihat peringkatmu di papan peringkat dunia hari ini sebelum layar berhenti.

Tanpa tutorial. Tanpa timer yang memohon kamu kembali. Hanya gua, pesawat, dan satu larian lagi.

- Satu gua harian, sama untuk setiap pemain di dunia
- Hantu larian terbaikmu untuk dikejar
- Papan peringkat dunia langsung saat kamu menabrak
- Tujuh koin power-up untuk dikelola
- Delapan pesawat untuk dibuka
- Kontrol satu tangan, satu tombol
- 15 bahasa, tanpa tutorial""",
    ios_notes="""- Koin digambar ulang: koin perisai, amunisi, dan magnet kini punya bentuk dan ukuran sendiri, terbaca sekilas, juga untuk buta warna
- Momen "+RECORD" baru saat kamu melewati rekor terbaikmu sepanjang masa, dengan suara sendiri
- Awal lebih halus: tanpa rintangan sebelum skor 25, agar kamu belajar terbang dulu
- Layar judul dibangun ulang, akses cepat ke peringkat, tantangan, dan pesawat
- Kartu berbagi lebih kaya, plus perbaikan pembelian di sebagian perangkat""",
    play_title="TUNL: gua harian",
    play_short="Tahan untuk terbang menembus gua mematikan. Baru tiap hari, sama untuk semua.",
    play_full="""TUNL adalah gim terbang di gua satu ketukan, dengan satu kejutan: hanya ada satu gua per hari, dan seluruh dunia memainkannya.

TAHAN untuk mendorong pesawatmu ke atas. LEPAS, dan gravitasi menariknya ke bawah. Itu seluruh kontrolnya, dan terowongan di sekitarmu makin menyempit makin jauh kamu terbang.

SATU GUA PER HARI, SAMA UNTUK SEMUA
Setiap hari TUNL membangun gua baru dari tanggal kalender, jadi setiap pemain di Bumi terbang di lorong yang sama persis. Tengah malam gua itu hilang selamanya dan yang berikutnya dimulai. Larian kuat pertamamu hari itu merekam hantu: tayangan ulang pesawatmu yang kamu lawan sepanjang sisa hari.

MUDAH DIPELAJARI, SUSAH DILEPAS
Tanpa tutorial, tanpa menu yang menghalangi. Kumpulkan koin untuk melebarkan lorong, ambil power-up untuk bertahan hidup - perisai, magnet, gerak lambat, bom, dan lainnya - dan serempet dinding untuk bonus nyaris kena. Saat kamu menabrak, kamu lihat di mana kamu mendarat di papan peringkat dunia hari ini, langsung.

FITUR
- Gua harian, sama untuk setiap pemain
- Kejar hantu larian terbaikmu sendiri
- Papan peringkat dunia harian langsung
- Tujuh koin power-up dengan bentuk berbeda
- Delapan pesawat yang bisa dibuka
- Kontrol satu tangan, satu tombol
- 15 bahasa, tanpa tutorial
- Bisa dimainkan offline

Gratis dimainkan, dengan pembelian opsional "Hapus Iklan" dan "Buka Semua Pesawat".""",
    play_notes="""- Koin digambar ulang: koin perisai, amunisi, dan magnet kini punya bentuk dan ukuran sendiri - mudah dibedakan sekilas, juga untuk buta warna
- Momen "+RECORD" baru begitu kamu melewati rekor terbaikmu sepanjang masa, dengan suara sendiri
- Awal lebih halus: tanpa rintangan sebelum skor 25
- Layar judul dibangun ulang: akses lebih cepat ke peringkat, tantangan, dan pesawat
- Kartu berbagi lebih kaya
- Perbaikan pembelian di sebagian perangkat""",
)

# ------------------------------------------------------------------ VI (full tone marks)
M["vi"] = dict(
    ios_name="TUNL: hang động mỗi ngày",
    ios_subtitle="Giữ để bay. Hang mới mỗi ngày.",
    ios_promo=(
        "Hôm nay cả thế giới bay qua cùng một hang động y hệt. Ngày mai nó biến mất "
        "và một hang mới xuất hiện. Bạn đi được bao xa trước khi hết ngày?"),
    ios_keywords="một chạm,một tay,hang động,đường hầm,bay,arcade,bất tận,bóng ma,bảng xếp hạng,phản xạ",
    ios_desc="""Giữ màn hình và phi thuyền bay lên. Thả ra, trọng lực kéo xuống. Đó là toàn bộ trò chơi, và khó hơn bạn nghĩ.

Mỗi ngày, TUNL dựng một hang động từ ngày tháng. Cả thế giới bay qua cùng hang động đó, rồi nó biến mất mãi mãi và một hang mới xuất hiện. Lượt chơi tốt đầu tiên trong ngày của bạn để lại một bóng ma. Đuổi theo. Vượt qua.

Hành lang hẹp dần khi bạn vào sâu. Nhặt xu để mở rộng nó và vật phẩm để sống sót: khiên, nam châm, làm chậm thời gian, bom và nhiều hơn. Lướt sát vách đá mà không chạm vào, bạn được thưởng suýt trúng. Đâm, và bạn thấy thứ hạng của mình trên bảng xếp hạng thế giới hôm nay trước khi màn hình dừng lại.

Không hướng dẫn. Không bộ đếm giờ nài nỉ bạn quay lại. Chỉ có một hang động, một phi thuyền và thêm một lượt nữa.

- Một hang động mỗi ngày, giống hệt cho mọi người chơi trên thế giới
- Một bóng ma từ lượt chơi tốt nhất của bạn để đuổi
- Bảng xếp hạng thế giới trực tiếp ngay khi bạn đâm
- Bảy xu vật phẩm cần cân nhắc
- Tám phi thuyền để mở khóa
- Điều khiển một tay, một nút
- 15 ngôn ngữ, không hướng dẫn""",
    ios_notes="""- Vẽ lại xu: xu khiên, đạn và nam châm giờ có hình dạng và kích thước riêng, nhìn một cái là rõ, kể cả người mù màu
- Khoảnh khắc "+RECORD" mới khi bạn vượt kỷ lục cao nhất mọi thời đại, có âm thanh riêng
- Khởi đầu nhẹ nhàng hơn: không chướng ngại vật trước điểm 25, để bạn học bay trước
- Xây lại màn hình tiêu đề, truy cập nhanh vào hạng, thử thách và phi thuyền
- Thẻ chia sẻ phong phú hơn, cộng với sửa lỗi mua hàng trên một số thiết bị""",
    play_title="TUNL: hang động mỗi ngày",
    play_short="Giữ để bay qua hang động chết người. Mỗi ngày một hang mới, cho mọi người.",
    play_full="""TUNL là trò chơi bay qua hang động chỉ với một chạm, kèm một điểm đặc biệt: mỗi ngày chỉ có một hang động, và cả thế giới cùng chơi nó.

GIỮ để đẩy phi thuyền lên trên. THẢ ra, trọng lực kéo nó xuống. Đó là toàn bộ điều khiển, và đường hầm quanh bạn càng lúc càng hẹp khi bạn bay xa hơn.

MỘT HANG ĐỘNG MỖI NGÀY, GIỐNG NHAU CHO TẤT CẢ
Mỗi ngày TUNL dựng một hang động hoàn toàn mới từ ngày trên lịch, nên mọi người chơi trên Trái Đất đều bay qua cùng một hành lang y hệt. Nửa đêm nó biến mất vĩnh viễn và hang tiếp theo bắt đầu. Lượt chơi tốt đầu tiên trong ngày của bạn ghi lại một bóng ma: bản phát lại phi thuyền của bạn mà bạn đua với nó cả ngày còn lại.

DỄ HỌC, KHÓ BUÔNG
Không hướng dẫn, không menu cản đường. Nhặt xu để mở rộng hành lang, lấy vật phẩm để sống sót - khiên, nam châm, làm chậm thời gian, bom và nhiều hơn - và lướt sát tường để ăn thưởng suýt trúng. Ngay khi bạn đâm, bạn thấy mình đáp xuống vị trí nào trên bảng xếp hạng thế giới hôm nay, trực tiếp.

TÍNH NĂNG
- Hang động hằng ngày, giống nhau cho mọi người chơi
- Đua với bóng ma từ lượt chơi tốt nhất của chính bạn
- Bảng xếp hạng thế giới hằng ngày trực tiếp
- Bảy xu vật phẩm với hình dạng khác nhau
- Tám phi thuyền có thể mở khóa
- Điều khiển một tay, một nút
- 15 ngôn ngữ, không hướng dẫn
- Chơi được ngoại tuyến

Chơi miễn phí, với các gói mua tùy chọn "Xóa quảng cáo" và "Mở khóa tất cả phi thuyền".""",
    play_notes="""- Vẽ lại xu: xu khiên, đạn và nam châm giờ có hình dạng và kích thước riêng - nhìn một cái là phân biệt được, kể cả người mù màu
- Khoảnh khắc "+RECORD" mới ngay khi bạn vượt kỷ lục cao nhất mọi thời đại, có âm thanh riêng
- Khởi đầu nhẹ nhàng hơn: không chướng ngại vật trước điểm 25
- Xây lại màn hình tiêu đề: truy cập nhanh hơn vào hạng, thử thách và phi thuyền
- Thẻ chia sẻ phong phú hơn
- Sửa lỗi mua hàng trên một số thiết bị""",
)

# ------------------------------------------------------------------ HI
M["hi"] = dict(
    ios_name="TUNL: रोज़ की गुफा",
    ios_subtitle="दबाकर उड़ें। हर दिन नई गुफा।",
    ios_promo=(
        "आज पूरी दुनिया बिल्कुल एक ही गुफा में उड़ रही है। कल यह गायब हो जाएगी और "
        "नई आ जाएगी। दिन खत्म होने से पहले आप कितनी दूर जा सकते हैं?"),
    ios_keywords="एक टैप,एक हाथ,गुफा,सुरंग,उड़ान,आर्केड,अंतहीन,घोस्ट,लीडरबोर्ड,रिफ्लेक्स,एक बटन",
    ios_desc="""स्क्रीन दबाए रखें और आपका यान ऊपर चढ़ता है। छोड़ें, और गुरुत्वाकर्षण संभाल लेता है। पूरा खेल यही है, और दिखने से ज़्यादा कठिन है।

हर दिन TUNL तारीख से एक गुफा बनाता है। पूरी दुनिया उसी एक जैसी गुफा में उड़ती है, फिर वह हमेशा के लिए चली जाती है और नई आ जाती है। दिन की आपकी पहली अच्छी रन एक घोस्ट छोड़ जाती है। उसका पीछा करें। उसे हराएँ।

जितना गहरे जाएँगे, गलियारा उतना संकरा होता जाता है। इसे चौड़ा करने के लिए सिक्के बटोरें और ज़िंदा रहने के लिए पावर-अप: शील्ड, मैग्नेट, स्लो-टाइम, बम और भी बहुत कुछ। चट्टान को छुए बिना उससे सटकर निकलें तो नियर-मिस बोनस मिलता है। टकराएँ, और स्क्रीन थमने से पहले ही आज की वर्ल्ड लीडरबोर्ड पर अपनी रैंक देख लें।

कोई ट्यूटोरियल नहीं। वापस बुलाने वाले टाइमर नहीं। बस एक गुफा, एक यान, और एक और रन।

- रोज़ एक गुफा, धरती के हर खिलाड़ी के लिए एक जैसी
- पीछा करने के लिए आपकी बेस्ट रन का एक घोस्ट
- टकराते ही लाइव वर्ल्ड लीडरबोर्ड
- संभालने के लिए सात पावर-अप सिक्के
- अनलॉक करने के लिए आठ यान
- एक हाथ, एक बटन का नियंत्रण
- 15 भाषाएँ, कोई ट्यूटोरियल नहीं""",
    ios_notes="""- सिक्के नए सिरे से बनाए: शील्ड, गोला-बारूद और मैग्नेट सिक्कों का अब अपना आकार और साइज़ है, एक नज़र में पहचानने योग्य, कलर-ब्लाइंड के लिए भी
- अपना ऑल-टाइम बेस्ट पार करते ही नया "+RECORD" पल, अपनी आवाज़ के साथ
- नरम शुरुआत: स्कोर 25 से पहले कोई बाधा नहीं, ताकि पहले उड़ना सीखें
- नया बना टाइटल स्क्रीन, रैंक, चुनौतियों और यानों तक तेज़ पहुँच
- ज़्यादा समृद्ध शेयर कार्ड, साथ ही कुछ डिवाइस पर खरीद की समस्याओं का समाधान""",
    play_title="TUNL: रोज़ की गुफा",
    play_short="दबाए रखें और एक जानलेवा गुफा में उड़ें। रोज़ एक नई, सबके लिए एक जैसी।",
    play_full="""TUNL एक-टैप वाला गुफा उड़ान खेल है, एक ख़ास बात के साथ: हर दिन सिर्फ़ एक गुफा होती है, और पूरी दुनिया उसे खेलती है।

अपने यान को ऊपर धकेलने के लिए दबाए रखें। छोड़ें, और गुरुत्वाकर्षण उसे नीचे खींचता है। पूरा नियंत्रण बस इतना है, और जितना आगे उड़ेंगे, आपके चारों ओर की सुरंग उतनी संकरी होती जाती है।

रोज़ एक गुफा, सबके लिए एक जैसी
हर दिन TUNL कैलेंडर की तारीख से एक बिल्कुल नई गुफा बनाता है, इसलिए धरती का हर खिलाड़ी ठीक उसी गलियारे में उड़ता है। आधी रात को वह हमेशा के लिए चली जाती है और अगली शुरू होती है। दिन की आपकी पहली दमदार रन एक घोस्ट रिकॉर्ड करती है: आपके यान का एक रीप्ले, जिससे आप बाकी दिन होड़ करते हैं।

सीखना आसान, छोड़ना मुश्किल
कोई ट्यूटोरियल नहीं, रास्ते में कोई मेन्यू नहीं। गलियारा चौड़ा करने के लिए सिक्के बटोरें, ज़िंदा रहने के लिए पावर-अप लें - शील्ड, मैग्नेट, स्लो-टाइम, बम और भी - और नियर-मिस बोनस के लिए दीवारों से सटकर निकलें। टकराते ही आप देखते हैं कि आज की लाइव वर्ल्ड लीडरबोर्ड पर आप कहाँ पहुँचे।

विशेषताएँ
- रोज़ की गुफा, हर खिलाड़ी के लिए एक जैसी
- अपनी ही बेस्ट रन के घोस्ट से होड़
- लाइव रोज़ाना वर्ल्ड लीडरबोर्ड
- अलग-अलग आकार वाले सात पावर-अप सिक्के
- आठ अनलॉक करने योग्य यान
- एक हाथ, एक बटन का नियंत्रण
- 15 भाषाएँ, कोई ट्यूटोरियल नहीं
- ऑफ़लाइन खेलें

मुफ़्त खेलें, वैकल्पिक "विज्ञापन हटाएँ" और "सभी यान अनलॉक करें" खरीद के साथ।""",
    play_notes="""- सिक्के नए सिरे से बनाए: शील्ड, गोला-बारूद और मैग्नेट सिक्कों का अब अपना आकार और साइज़ है - एक नज़र में फ़र्क साफ़, कलर-ब्लाइंड के लिए भी
- अपना ऑल-टाइम बेस्ट पार करते ही नया "+RECORD" पल, अपनी आवाज़ के साथ
- नरम शुरुआत: स्कोर 25 से पहले कोई बाधा नहीं
- नया बना टाइटल स्क्रीन: रैंक, चुनौतियों और यानों तक तेज़ पहुँच
- ज़्यादा समृद्ध शेयर कार्ड
- कुछ डिवाइस पर खरीद की समस्याओं का समाधान""",
)

# ------------------------------------------------------------------ writer + validator
FIELD_FILES_IOS = [
    ("ios_name", "name.txt"), ("ios_subtitle", "subtitle.txt"),
    ("ios_promo", "promotional_text.txt"), ("ios_keywords", "keywords.txt"),
    ("ios_desc", "description.txt"), ("ios_notes", "release_notes.txt"),
]
FIELD_FILES_PLAY = [
    ("play_title", "title.txt"), ("play_short", "short_description.txt"),
    ("play_full", "full_description.txt"),
]


def w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.rstrip() + "\n")


def main():
    rows = []
    over = []
    for loc, d in M.items():
        for key, fname in FIELD_FILES_IOS:
            w(os.path.join(ROOT, "ios", loc, fname), d[key])
        for key, fname in FIELD_FILES_PLAY:
            w(os.path.join(ROOT, "android", loc, fname), d[key])
        w(os.path.join(ROOT, "android", loc, "changelogs", f"{VERSION_CODE}.txt"),
          d["play_notes"])
        for key in LIM:
            n = len(d[key])
            if n > LIM[key]:
                over.append(f"{loc}/{key}: {n}/{LIM[key]}")
            rows.append((loc, key, n, LIM[key]))

    lines = ["# 8.0 store metadata - character counts", "",
             "Folder = in-game lang code. ASC/Play locale codes in build-metadata.py",
             "(LOCALE_CODES) - VERIFY against the live consoles before upload.", "",
             "| locale | field | chars | limit | |",
             "|---|---|---:|---:|---|"]
    for loc, key, n, lim in rows:
        mark = "" if n <= lim else " **OVER**"
        lines.append(f"| {loc} | {key} | {n} | {lim} |{mark} |")
    w(os.path.join(ROOT, "OVERVIEW.md"), "\n".join(lines))

    print("wrote %d locale sets" % len(M))
    if over:
        print("\nFIELDS OVER LIMIT:")
        for o in over:
            print("  " + o)
        sys.exit(1)
    print("all fields within limits")


if __name__ == "__main__":
    main()
