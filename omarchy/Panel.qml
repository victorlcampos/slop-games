import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model
import "Catalog.js" as Catalog

// The catalog, on the bar.
//
// One file, like seven of the first-party widgets (power, network, bluetooth…):
// a `Panel` from qs.Ui is both the button the bar drops into a section and the
// popup that button opens, so there is no second entry point to keep in step.
//
// Clicking a row runs `omarchy-launch-webapp`, which opens the default browser
// with --app= — a window with no tabs and no address bar. That is as close to
// "the game is an application" as a single HTML file gets, and it is the reason
// this plugin launches instead of trying to draw a game itself: Quickshell has
// no web engine, and every game here is a canvas.
Panel {
  id: root
  moduleName: "victorlcampos.slop-games"
  // `omarchy-shell slop-games toggle` — which is what a Hyprland bind calls.
  ipcTarget: "slop-games"

  readonly property var games: Catalog.GAMES
  readonly property string lang: Model.language(Qt.locale().name, setting("lang", ""))

  // Where the built games are, or "" for the published site. Filled in by the
  // probe below, which is the only thing here that touches the filesystem.
  property string libraryRoot: ""
  readonly property bool local: Model.isLocal(libraryRoot)

  // Panel.qml lives in omarchy/; the games do not.
  readonly property string pluginDir: Model.parentDir(Model.dirFromUrl(Qt.resolvedUrl(".")))

  property int cursor: 0
  // The cursor only paints once a key or the mouse has moved it: an open panel
  // with a highlighted row reads as "this one is selected", and nothing is.
  property bool cursorActive: false

  function play(index) {
    if (index < 0 || index >= games.length) return
    Quickshell.execDetached(Model.launchCommand(Model.gameUrl(games[index].slug, libraryRoot, Catalog.SITE)))
    close()
  }

  function openCatalog() {
    Quickshell.execDetached(Model.launchCommand(Model.catalogUrl(libraryRoot, Catalog.SITE)))
    close()
  }

  function moveCursor(delta) {
    // The first keypress reveals the cursor where it already is instead of
    // moving it, so "down" never skips the row you were looking at.
    if (!cursorActive) { cursorActive = true; return }
    cursor = Model.moveCursor(cursor, delta, games.length)
  }

  // Writing the choice back into shell.json is what makes it survive a restart;
  // an unset value means "follow the system locale", which is the default.
  function setLanguage(value) {
    root.settings = Object.assign({}, root.settings, { lang: value })
    if (root.bar && root.bar.shell) root.bar.shell.updateEntryInline(root.moduleName, root.settings)
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: {
    if (opened) {
      cursorActive = false
      cursor = 0
      if (!probe.running) probe.running = true
    }
  }

  // Asked once at startup and again on every open, because a dist/ can appear
  // between them — somebody runs the build in their checkout and the panel
  // should notice without a shell restart.
  Process {
    id: probe
    command: Model.probeCommand(
      Model.rootCandidates(root.pluginDir, Quickshell.env("SLOP_GAMES_DIR"), Quickshell.env("HOME")))
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.libraryRoot = String(text).trim()
    }
  }

  Component.onCompleted: probe.running = true

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // nf-fa-gamepad. An emoji here would be the one glyph on the bar that is
    // not from the bar's own font.
    text: "\uf11b"
    tooltipText: Model.t("tooltip", root.lang)
    onPressed: function (b) { if (b === Qt.LeftButton) root.toggle() }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(column.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function (dx, dy) { if (dy !== 0) root.moveCursor(dy) }
      onActivateRequested: if (root.cursorActive) root.play(root.cursor)
      onCloseRequested: root.close()
      onTabRequested: function (direction) { root.switchPanel(direction) }

      Column {
        id: column
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(12)

        // ---------------------------------------------------- hero
        Item {
          width: parent.width
          implicitHeight: Math.max(heroIcon.implicitHeight, heroText.implicitHeight)

          Text {
            id: heroIcon
            text: "\uf11b"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.display
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
          }

          Column {
            id: heroText
            anchors.left: heroIcon.right
            anchors.leftMargin: Style.space(14)
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)

            Text {
              text: "slop-games"
              color: root.bar.foreground
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.title
              font.bold: true
              width: parent.width
              elide: Text.ElideRight
            }

            Text {
              text: Model.t("subtitle", root.lang, { n: root.games.length })
              color: Qt.darker(root.bar.foreground, 1.4)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              width: parent.width
              elide: Text.ElideRight
            }
          }
        }

        PanelSeparator { foreground: root.bar.foreground }

        // ---------------------------------------------------- the games
        //
        // ListView rather than a Repeater in a Column: it owns its scroll
        // position, so j/k past the bottom row scrolls instead of walking the
        // cursor off screen. Ten games fit on a desktop; a laptop with a big
        // font does not, and this is what makes that case work.
        ListView {
          id: list
          width: parent.width
          height: Math.min(contentHeight, Style.space(430))
          spacing: Style.space(4)
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          interactive: contentHeight > height

          ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

          model: root.games
          currentIndex: root.cursorActive ? root.cursor : -1
          onCurrentIndexChanged: if (currentIndex >= 0) positionViewAtIndex(currentIndex, ListView.Contain)

          delegate: GameRow {
            required property var modelData
            required property int index

            width: ListView.view.width
            game: modelData
            rowIndex: index
          }
        }

        PanelSeparator { foreground: root.bar.foreground }

        // ---------------------------------------------------- footer
        Button {
          width: parent.width
          iconText: "\uf00a"
          iconSize: Style.font.body
          text: Model.t("openCatalog", root.lang)
          fontSize: Style.font.bodySmall
          foreground: root.bar.foreground
          fontFamily: root.bar.fontFamily
          bordered: true
          onClicked: root.openCatalog()
        }

        Item {
          width: parent.width
          implicitHeight: Math.max(sourceText.implicitHeight, flags.implicitHeight)

          Column {
            id: sourceText
            anchors.left: parent.left
            anchors.right: flags.left
            anchors.rightMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)

            Text {
              text: Model.t(root.local ? "fromDisk" : "fromWeb", root.lang)
              color: Qt.darker(root.bar.foreground, 1.4)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              width: parent.width
              elide: Text.ElideRight
            }

            Text {
              text: Model.t("hint", root.lang)
              color: Qt.darker(root.bar.foreground, 1.8)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              width: parent.width
              elide: Text.ElideRight
            }
          }

          // Two flags, one choice — the same contract every game here honours,
          // except that on a bar there is no room to draw a flag, so the label
          // is the language's own name for itself.
          Row {
            id: flags
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(6)

            Button {
              text: "EN"
              fontSize: Style.font.caption
              foreground: root.bar.foreground
              fontFamily: root.bar.fontFamily
              horizontalPadding: Style.space(8)
              verticalPadding: Style.space(3)
              bordered: true
              active: root.lang === "en"
              onClicked: root.setLanguage("en")
            }

            Button {
              text: "PT"
              fontSize: Style.font.caption
              foreground: root.bar.foreground
              fontFamily: root.bar.fontFamily
              horizontalPadding: Style.space(8)
              verticalPadding: Style.space(3)
              bordered: true
              active: root.lang === "pt"
              onClicked: root.setLanguage("pt")
            }
          }
        }
      }
    }
  }

  // One game: emoji, name, the first sentence of what it is, and — only for the
  // one game that needs a connection — the badge the index card carries too.
  component GameRow: CursorSurface {
    id: row
    required property var game
    required property int rowIndex

    hasCursor: root.cursorActive && root.cursor === rowIndex
    foreground: root.bar.foreground
    implicitHeight: rowContent.implicitHeight + Style.spacing.rowPaddingX

    MouseArea {
      id: rowMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      // Hover owns the same cursor the keyboard does — CursorSurface's contract
      // is that only one row is ever lit, whichever moved it.
      onContainsMouseChanged: if (containsMouse) { root.cursorActive = true; root.cursor = row.rowIndex }
      onClicked: root.play(row.rowIndex)
    }

    Item {
      id: rowContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.leftMargin: Style.space(8)
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      implicitHeight: Math.max(rowEmoji.implicitHeight, rowText.implicitHeight)

      Text {
        id: rowEmoji
        text: row.game.emoji
        color: root.bar.foreground
        font.family: root.bar.fontFamily
        font.pixelSize: Style.font.heading
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
      }

      Column {
        id: rowText
        anchors.left: rowEmoji.right
        anchors.leftMargin: Style.space(10)
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(1)

        Row {
          width: parent.width
          spacing: Style.space(6)

          Text {
            text: Model.pick(row.game.name, root.lang)
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
            elide: Text.ElideRight
            // Let the name take what it needs and the badge what is left: a
            // fixed split clips one language or the other, and which one is
            // never the language you happen to be reading.
            width: Math.min(implicitWidth, parent.width - (badge.visible ? badge.implicitWidth + parent.spacing : 0))
          }

          Text {
            id: badge
            visible: !row.game.offline
            text: Model.t("needsNetwork", root.lang)
            color: Qt.darker(root.bar.foreground, 1.6)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            anchors.verticalCenter: parent.verticalCenter
          }
        }

        Text {
          text: Model.pick(row.game.blurb, root.lang)
          color: Qt.darker(root.bar.foreground, 1.5)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.caption
          width: parent.width
          wrapMode: Text.WordWrap
          maximumLineCount: 2
          elide: Text.ElideRight
        }
      }
    }
  }
}
