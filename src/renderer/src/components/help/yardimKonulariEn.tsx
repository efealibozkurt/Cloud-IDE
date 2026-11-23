import { Ad, Adim, Adimlar, Baslik, Ipucu, Liste, Madde, Par, Tus, type YardimKonusu } from './yardimKonulari'

/**
 * Yardım konularının İngilizce sürümü. Kimlikler Türkçe sürümle aynıdır;
 * `anahtarlar` aramanın iki dilde de çalışması için İngilizce ve Türkçe kelimeleri birlikte içerir.
 */
export const YARDIM_KONULARI_EN: YardimKonusu[] = [
  {
    id: 'baslangic',
    baslik: 'Quick start',
    ozet: '5 steps to upload your first program to a board',
    anahtarlar: 'start first program led blink setup upload başla ilk program',
    icerik: () => (
      <>
        <Par>Cloud IDE is an editor for writing and uploading programs to Arduino-compatible boards (Arduino, ESP32, Deneyap, etc.). For your first program:</Par>
        <Adimlar>
          <Adim no={1}>
            <Ad>Open a new project.</Ad> <Tus>Ctrl</Tus>+<Tus>N</Tus> creates an empty project. To start from a ready-made example, use the <Ad>Examples</Ad> menu in the top bar.
          </Adim>
          <Adim no={2}>
            <Ad>Select your board.</Ad> Click the board selector in the top bar. If your board is not listed, install its package from the <Ad>Board manager</Ad> on the left (see the <Ad>Boards and libraries</Ad> topic).
          </Adim>
          <Adim no={3}>
            <Ad>Connect the board and select the port.</Ad> When you plug it in over USB, a new port (e.g. COM3) appears in the port selector. The port list refreshes by itself every 3 seconds.
          </Adim>
          <Adim no={4}>
            <Ad>Build.</Ad> The <Ad>Build</Ad> button (<Tus>Ctrl</Tus>+<Tus>R</Tus>) checks your code. Any errors are listed line by line in the <Ad>Problems</Ad> tab at the bottom.
          </Adim>
          <Adim no={5}>
            <Ad>Upload.</Ad> The <Ad>Upload</Ad> button (<Tus>Ctrl</Tus>+<Tus>U</Tus>) builds first, then sends the program to the board. You can watch the result in the <Ad>Serial Monitor</Ad>.
          </Adim>
        </Adimlar>
        <Par>A short tour runs on first launch; to watch it again, use the <Ad>Watch the getting-started tour again</Ad> button at the bottom left of this window.</Par>
        <Ipucu>Wherever you get stuck, the <Ad>?</Ad> button in a section header opens help for that section. You can always reach this window with <Tus>F1</Tus>.</Ipucu>
      </>
    )
  },
  {
    id: 'projeler',
    baslik: 'Projects and files',
    ozet: 'Workspace, multiple projects, adding files',
    anahtarlar: 'file project workspace sketch ino header new window save as autocomplete intellisense hover signature dosya proje çalışma alanı',
    icerik: () => (
      <>
        <Par>Each project (sketch) is a folder with the same name; the main file is <Ad>project_name.ino</Ad>. You can split your code by adding files such as <Ad>.h</Ad> and <Ad>.cpp</Ad> next to it.</Par>
        <Baslik>Files panel</Baslik>
        <Liste>
          <Madde baslik="Multiple projects">You can open several projects together in the same window. Click one in the project list to make it active.</Madde>
          <Madde baslik="Project to build">When more than one project is open, a project selector appears in the top bar; <Ad>Build</Ad> and <Ad>Upload</Ad> apply to that project.</Madde>
          <Madde baslik="Right-click menu">Right-click a project to add a new file, make it the build target, open it in a new window, make a copy with <Ad>Save as</Ad>, or close it.</Madde>
          <Madde baslik="New window">
            <Tus>Ctrl</Tus>+<Tus>Shift</Tus>+<Tus>N</Tus> opens a separate IDE window; handy when you work on two screens.
          </Madde>
        </Liste>
        <Baslik>Project from a template</Baslik>
        <Par>Instead of starting from scratch, use the <Ad>Project from template</Ad> button in the <Ad>Files</Ad> panel header. Ready-made projects include LED blink, DHT temperature sensor, ultrasonic distance, servo, NeoPixel, OLED display, relay, and LED control from a web page on ESP.</Par>
        <Adimlar>
          <Adim no={1}>First <Ad>select your board</Ad> in the top bar; the code is adapted to the board you choose (Arduino, ESP32, ESP8266).</Adim>
          <Adim no={2}>Pick the template from the list and change the pins to match your wiring. The wizard warns you right away if you enter an invalid pin.</Adim>
          <Adim no={3}>In the <Ad>Wiring</Ad> section on the right you see which wire goes where. Missing libraries are installed with one click.</Adim>
          <Adim no={4}>Press <Ad>Create project</Ad>; the project opens and all you need to do is press <Ad>Upload</Ad>.</Adim>
        </Adimlar>
        <Baslik>Offline code completion (IntelliSense)</Baslik>
        <Par>The code editor offers fully offline autocompletion, function descriptions and parameter hints, with no internet connection or external compiler server.</Par>
        <Liste>
          <Madde baslik="Arduino and ESP32 API">As you type, core functions (<Ad>pinMode</Ad>, <Ad>digitalWrite</Ad>, <Ad>millis</Ad>…), pin constants for the selected board and ready-made snippets (<Ad>setup</Ad>, <Ad>loop</Ad>, <Ad>millis_zamanlayici</Ad>) are suggested.</Madde>
          <Madde baslik="Installed libraries and object members">The header files of libraries installed on your computer are scanned. While typing <Ad>#include &lt;</Ad> you can pick headers, and after an object name followed by <Ad>.</Ad> (<Ad>Serial.</Ad> or <Ad>sensor.</Ad>) you see the class methods.</Madde>
          <Madde baslik="Description and parameter hint">Hovering over a function shows its description and signature; when you open a parenthesis <Ad>(</Ad>, the parameter you are filling in is highlighted.</Madde>
        </Liste>
        <Baslik>Saving</Baslik>
        <Par>
          <Tus>Ctrl</Tus>+<Tus>S</Tus> saves the open file; <Ad>Build</Ad> and <Ad>Upload</Ad> save unsaved files themselves. Unsaved tabs show a dot next to the name.
        </Par>
        <Ipucu tur="dikkat">Code you open from the Examples menu is read-only sample code. To keep your changes, first right-click the project and copy it to your own folder with <Ad>Save as (create copy)</Ad>.</Ipucu>
        <Par>Your projects are kept by default in the <Ad>Documents › Cloud_IDE_Sketches</Ad> folder.</Par>
      </>
    )
  },
  {
    id: 'notlar',
    baslik: 'Project notes',
    ozet: 'Wiring, parts list and to-dos',
    anahtarlar: 'note notes todo list wiring parts md not notlar yapılacak',
    icerik: () => (
      <>
        <Par>In electronics projects, "which wire did I plug where?" matters as much as the code. The <Ad>Project notes</Ad> icon in the left bar gives every project a notebook.</Par>
        <Liste>
          <Madde baslik="Saved as you type">You don't need to press a button.</Madde>
          <Madde baslik="Checkboxes">Write <Ad>- [ ]</Ad> at the start of a line and in Preview you get a to-do list you can click to tick; the number completed is shown at the top.</Madde>
          <Madde baslik="Start from a template">Brings ready-made headings for parts used, connections and to-dos.</Madde>
          <Madde baslik="Fill from code">Adds the libraries and pins used in your code and the selected board to the notes. The easiest way to remember what each pin is for.</Madde>
        </Liste>
        <Ipucu>Notes are a plain file called <Ad>NOTLAR.md</Ad> in the project folder. It goes into version history and the .zip package together with the code, so when you return to an old version you also return to that day's notes.</Ipucu>
      </>
    )
  },
  {
    id: 'kartlar',
    baslik: 'Boards and libraries',
    ozet: 'Installing board packages and libraries, examples',
    anahtarlar: 'board manager library manager core package install remove esp32 arduino deneyap servo kart kütüphane çekirdek',
    icerik: () => (
      <>
        <Baslik>Board manager</Baslik>
        <Par>To use a board, its manufacturer's <Ad>board package</Ad> (core) must be installed first. Click the chip icon in the left bar:</Par>
        <Adimlar>
          <Adim no={1}>Find the package in the list (e.g. <Ad>esp32</Ad>, <Ad>Arduino AVR Boards</Ad>, <Ad>Deneyap</Ad>); you can also recognize it from the board photos.</Adim>
          <Adim no={2}>Press <Ad>Install</Ad>. The download can take a few minutes depending on its size; you see the progress in the <Ad>Output</Ad> tab.</Adim>
          <Adim no={3}>When installation finishes, your board appears in the board selector in the top bar.</Adim>
        </Adimlar>
        <Baslik>Library manager</Baslik>
        <Par>Libraries provide ready-made code for hardware such as sensors, displays and motors. Click the book icon, type a name in the search box (e.g. <Ad>Servo</Ad>, <Ad>DHT</Ad>, <Ad>Adafruit NeoPixel</Ad>) and press <Ad>Install</Ad>. After installing, add the line <Ad>#include &lt;Library.h&gt;</Ad> to your code.</Par>
        <Baslik>Board settings</Baslik>
        <Par>Some boards have extra options: the processor for Nano ("Old Bootloader"), partition scheme, CPU speed and upload speed for ESP32, and so on. When such a board is selected, a small <Ad>Board settings</Ad> button appears next to the board selector (the equivalent of the Tools menu in Arduino IDE). If uploads stop with errors like "not in sync", look here first. Settings are remembered per board; Cloud AI builds use the same settings.</Par>
        <Baslik>Board detection</Baslik>
        <Par>When you plug a board into USB and its board package is installed, a <Ad>Use this board</Ad> suggestion appears at the top. If the board cannot be recognized, the USB chip (CH340, CP210x, FTDI…) is used to tell you what kind of board it might be.</Par>
        <Baslik>Library updates</Baslik>
        <Par>When a newer version of an installed library comes out, a number badge appears on the Library manager icon; the blue banner at the top of the panel has the list and an <Ad>Update all</Ad> button. A new version may sometimes change functions; build and try your project after updating. Version history records which version you built with, so you can go back if needed.</Par>
        <Baslik>Examples</Baslik>
        <Par>The <Ad>Examples</Ad> menu in the top bar lists ready-made examples for the boards and libraries you have installed. The easiest way to try a new library is to open and run its example first.</Par>
        <Ipucu>It uses the same board and library sources as Arduino IDE; you don't need to download again what you already installed.</Ipucu>
      </>
    )
  },
  {
    id: 'derleme',
    baslik: 'Building and uploading',
    ozet: 'Build vs. Upload, output, errors and the memory bars',
    anahtarlar: 'build compile upload error warning problems output flash ram memory size derle yükle hata',
    icerik: () => (
      <>
        <Liste>
          <Madde baslik="Build"><Tus>Ctrl</Tus>+<Tus>R</Tus>. Converts the code to machine code and looks for errors; sends nothing to the board. Safe for trying out your code.</Madde>
          <Madde baslik="Upload"><Tus>Ctrl</Tus>+<Tus>U</Tus>. Builds first and, if there are no errors, sends it to the board. The board must be connected and a port selected.</Madde>
        </Liste>
        <Baslik>Bottom panel</Baslik>
        <Liste>
          <Madde baslik="Output">Live logs from the compiler and uploader. If something goes wrong, the reason is written here.</Madde>
          <Madde baslik="Problems">Errors and warnings are listed with line numbers; clicking one jumps to that line in the editor. This tab opens by itself when a build ends with an error.</Madde>
          <Madde baslik="Pin check">Checks your pin usage against the board (see the separate topic).</Madde>
        </Liste>
        <Baslik>When you get a build error</Baslik>
        <Liste>
          <Madde baslik="Explain">The button next to each error in Problems prepares the error and the surrounding code in the Cloud AI panel; you can ask it to explain the cause and the fix.</Madde>
          <Madde baslik="Missing library">For a “…h: No such file or directory” error, installable libraries are suggested at the bottom. <Ad>Install and build</Ad> downloads the library and restarts the build.</Madde>
        </Liste>
        <Baslik>Flash and RAM bars</Baslik>
        <Par>After a successful build, two bars appear at the right of the bottom panel:</Par>
        <Liste>
          <Madde baslik="Flash">What percentage of the board's program memory your program occupies.</Madde>
          <Madde baslik="RAM">What percentage of the board's working memory the variables use.</Madde>
        </Liste>
        <Par>The bar turns yellow above 85% and red above 95%. If RAM gets close to full the program may behave strangely; keeping long texts in flash with the <Ad>F()</Ad> macro helps.</Par>
        <Ipucu>Every successful build also records in <Ad>Version history</Ad> which board and library versions that version was built with.</Ipucu>
      </>
    )
  },
  {
    id: 'seri',
    baslik: 'Serial monitor',
    ozet: 'Watching data from the board, multiple ports',
    anahtarlar: 'serial monitor baud port connect timestamp bootloader multiple two boards println seri monitör bağlan',
    icerik: () => (
      <>
        <Par>It is the way to see the <Ad>Serial.println()</Ad> output of your code and to send commands to the board. Open it with the <Ad>Serial Monitor</Ad> button in the top bar (<Tus>Ctrl</Tus>+<Tus>Shift</Tus>+<Tus>M</Tus>).</Par>
        <Adimlar>
          <Adim no={1}>Select the port and the <Ad>baud rate</Ad> in the top bar. The baud rate must match the value in your <Ad>Serial.begin(…)</Ad>; otherwise you see meaningless characters.</Adim>
          <Adim no={2}>Click <Ad>Connect</Ad>. Incoming lines start to flow.</Adim>
          <Adim no={3}>Type in the box at the bottom and send with <Tus>Enter</Tus>. Set the line-ending choice (NL, CR, NL+CR) to what the code on the board expects.</Adim>
        </Adimlar>
        <Baslik>Watching several boards at once</Baslik>
        <Par>While one port is connected, pick another port in the top bar and press <Ad>Add port</Ad>. Other connections stay open; a separate tab for each port and an <Ad>All</Ad> tab appear at the top. In the <Ad>All</Ad> view each line starts with a colored label showing which port it came from. Sending, clearing and disconnecting apply to the selected tab.</Par>
        <Baslik>Chart view</Baslik>
        <Par>With the <Ad>Text / Chart</Ad> switch at the top right you can turn incoming numbers into a live line chart; very useful when tuning sensor values. Print one of these formats in your code:</Par>
        <Liste>
          <Madde><Ad>Serial.println(value);</Ad> a single line</Madde>
          <Madde><Ad>10,20,30</Ad> (separated by commas or spaces) multiple lines</Madde>
          <Madde><Ad>temperature:23.5 humidity:60</Ad> named lines; the names appear above the chart and you can hide a line by clicking it</Madde>
        </Liste>
        <Par>The window selector sets how many samples are shown, and <Ad>Pause</Ad> freezes the stream.</Par>
        <Baslik>Useful options</Baslik>
        <Liste>
          <Madde baslik="Timestamp">Adds the time at the start of each line.</Madde>
          <Madde baslik="Auto-scroll">Always shows the newest line; turns itself off when you scroll up.</Madde>
          <Madde baslik="Hide bootloader">Dims and filters the technical lines the ESP32 prints at startup (rst:, load:, entry …).</Madde>
          <Madde baslik="Ask AI and error highlighting">ESP32 crash, Watchdog (WDT) or Brownout lines are highlighted in red. The <Ad>Ask AI</Ad> button at the top sends the latest output straight to Cloud AI; the assistant can also read the open serial port itself while it works.</Madde>
        </Liste>
        <Ipucu>During an upload the relevant port is closed briefly and reopened when the upload finishes. It says "Temporarily closed for upload" meanwhile; don't worry.</Ipucu>
      </>
    )
  },
  {
    id: 'pin',
    baslik: 'Pin check',
    ozet: 'Catch pin mistakes before the code runs',
    anahtarlar: 'pin check gpio pwm servo interrupt flash adc2 conflict warning board pin denetim çakışma',
    icerik: () => (
      <>
        <Par>The <Ad>Pin check</Ad> tab in the bottom panel reads your code and shows common pin-usage mistakes <Ad>for the selected board</Ad>. It updates by itself as you type; when you change the board, the result changes too.</Par>
        <Baslik>What it catches</Baslik>
        <Liste>
          <Madde baslik="A pin the board doesn't have">For example <Ad>pinMode(30, OUTPUT)</Ad> on an Uno.</Madde>
          <Madde baslik="analogWrite on a non-PWM pin">On the Uno only pins 3, 5, 6, 9, 10, 11 do PWM.</Madde>
          <Madde baslik="A pin without interrupt support">On the Uno <Ad>attachInterrupt</Ad> works only on 2 and 3.</Madde>
          <Madde baslik="ESP32-specific">Pins 6–11 are connected to flash memory (not usable); 34–39 are input-only; <Ad>analogRead</Ad> does not work on ADC2 pins while Wi-Fi is on; 0, 2, 5, 12, 15 can affect boot.</Madde>
          <Madde baslik="Conflicts">Attaching both a servo and another function to the same pin, attaching two servos to the same pin, using <Ad>digitalWrite</Ad> without a <Ad>pinMode</Ad> call, using pins 0/1 while using Serial.</Madde>
        </Liste>
        <Baslik>Board pin map</Baslik>
        <Par>The tab draws all pins of the selected board as small boxes; the colored dots in each box show what the pin can do (PWM, analog, interrupt, I2C, SPI…). Pins you use in your code are marked with a blue outline; hovering over a pin shows all its features and its role in the code. Red struck-through pins are connected to flash memory; don't use them. The map exists for Arduino Uno/Nano/Mega, ESP32 and ESP8266.</Par>
        <Baslik>What you see in the tab</Baslik>
        <Par>A status line at the top (how many files were scanned, which board's rules were applied), then the findings; clicking a finding jumps to that line in the editor. At the very bottom is a table showing the roles of all pins used in your code; you can consult it while wiring.</Par>
        <Baslik>Wiring Guide tab</Baslik>
        <Par>The <Ad>Wiring Guide</Ad> tab in the bottom panel reads the sensors, displays, motors and pins used in your code and produces an interactive wiring diagram. It shows 3.3V / 5V logic compatibility and missing-resistor warnings; with the <Ad>Generate with AI</Ad> button Cloud AI can deepen the guide and save it into the project, and with the <Ad>Connected</Ad> checkboxes you can track your wiring steps.</Par>
        <Ipucu tur="dikkat">This is a preliminary check, not a compiler. If a pin number is computed with a variable it cannot be checked and is skipped. Specific rules currently exist only for Arduino Uno/Nano/Mega, ESP32 and ESP8266; on other boards only conflict checks run. If you don't select a board in the top bar, board rules cannot be applied.</Ipucu>
      </>
    )
  },
  {
    id: 'gecmis',
    baslik: 'Version history',
    ozet: 'Return to earlier states of your project, experiment, back up',
    anahtarlar: 'version history restore diff tag branch commit backup zip package git old code sürüm geçmişi geri yükle',
    icerik: () => (
      <>
        <Par>Version history stores the states of your project over time. When "it worked yesterday, now it's broken", you can go back to an old version or see the difference between two states. Open it from the <Ad>Version history</Ad> icon in the left bar; it applies to the active project.</Par>
        <Baslik>Basic use</Baslik>
        <Adimlar>
          <Adim no={1}>At a moment when your code works, press <Ad>Save version</Ad>. You can write a short note if you like ("LED speed adjusted").</Adim>
          <Adim no={2}>The status line at the top shows how many files have changed since the last save. <Ad>View changes</Ad> opens the diff.</Adim>
          <Adim no={3}>On a version in the list, <Ad>Diff</Ad> compares with the previous version and <Ad>With current</Ad> compares with today's state.</Adim>
          <Adim no={4}><Ad>Restore</Ad> brings back the files of that version. Today's state is first saved automatically as "before restore", so if you regret it, that can be undone too.</Adim>
        </Adimlar>
        <Baslik>Automatic snapshots</Baslik>
        <Par>Even if you do nothing, snapshots are taken at these moments: before saving (at most every 2 minutes), before Cloud AI touches files, and when building if the code changed. They appear in the list as "automatic", "before AI" or "build". The number of automatic snapshots is limited (50 by default); versions you saved by hand and versions you tagged are never deleted. You can turn this off or change the limit in the <Ad>Version history</Ad> section of Settings.</Par>
        <Baslik>Build information</Baslik>
        <Par>Built versions show a green dot, the Flash/RAM usage and the flash difference from the previous build. When you go back to an old version, you are warned if it was built with a different board or library version. If you get a build error, the <Ad>what changed since the last built version</Ad> link at the top of the panel helps you find where the problem came from.</Par>
        <Baslik>Tags and branches</Baslik>
        <Liste>
          <Madde baslik="Tag">Gives an important version a name ("v1.0", "sent-to-the-fair"). It appears with a blue outline in the list.</Madde>
          <Madde baslik="Create branch">Starts a separate line of experiments from a version; your main line stays intact. You switch between them with the <Ad>Branch</Ad> selector. If the experiment doesn't work out, throw it away with <Ad>Delete branch</Ad>. (Merging branches is not available yet.)</Madde>
        </Liste>
        <Baslik>Backup and sharing</Baslik>
        <Par><Ad>Package (.zip)</Ad> at the bottom of the panel writes the project with its whole history into a single file; <Ad>Import</Ad> opens such a package as a new project on another computer.</Par>
        <Ipucu>The history lives in a hidden <Ad>.history</Ad> folder inside the project's own folder. If you move the project the history comes with it; if you delete the folder the history is deleted too.</Ipucu>
      </>
    )
  },
  {
    id: 'ai',
    baslik: 'Cloud AI assistant',
    ozet: 'The AI that writes code and fixes errors, and using it safely',
    anahtarlar: 'ai artificial intelligence assistant cloud api key permission approval undo model ollama lm studio knowledge base context yapay zeka asistan',
    icerik: () => (
      <>
        <Par>Cloud AI is an assistant that can read your project, write code, build and fix errors. Open it on the right with the <Ad>Cloud AI</Ad> button in the top bar.</Par>
        <Baslik>First setup</Baslik>
        <Adimlar>
          <Adim no={1}>Use the gear icon at the top right to go to <Ad>Settings › Artificial intelligence</Ad>, choose a provider and paste your API key. The key is stored only on this computer, encrypted by the operating system.</Adim>
          <Adim no={2}>If you don't want internet, you can use a local model running on your computer with <Ad>Ollama</Ad> or <Ad>LM Studio</Ad>; no key is needed.</Adim>
          <Adim no={3}>Choose the provider and model at the top of the panel, type your request in the box at the bottom and send with <Tus>Enter</Tus> ("Blink the LED on D13 once a second").</Adim>
        </Adimlar>
        <Baslik>Change permission: you are in control</Baslik>
        <Par>With the shield icon next to the input box you choose how free the assistant is:</Par>
        <Liste>
          <Madde baslik="With approval (recommended)">Before writing a file it shows what will change as a diff. You say <Ad>Apply</Ad> or <Ad>Reject</Ad>.</Madde>
          <Madde baslik="Semi-automatic">Writes files itself; still asks for things like deleting, renaming and installing libraries.</Madde>
          <Madde baslik="Fully automatic">Asks nothing. Changes can still be undone.</Madde>
        </Liste>
        <Par>When the assistant finishes, the <Ad>Undo changes</Ad> link under the reply restores all file changes in that reply with one click. A snapshot of your project is also taken in <Ad>Version history</Ad> before the assistant works.</Par>
        <Baslik>Working with selected code</Baslik>
        <Par>When you select code with the mouse in the editor, a small toolbar appears above it: <Ad>Fix with AI</Ad> asks it to fix the selected code, <Ad>Explain</Ad> has it explain line by line what the code does, in beginner-friendly language (it doesn't change the code), and <Ad>Enter prompt</Ad> adds the selected code to the panel and lets you write your own request. In all three the prompt is prepared in the panel; you press <Tus>Enter</Tus> to send it.</Par>
        <Baslik>Knowledge base and hardware tools</Baslik>
        <Par><Ad>Hardware and knowledge base</Ad> at the bottom of the panel shows the board information, library documentation and custom notes you can add that the assistant uses. The assistant can also read the open <Ad>Serial Monitor</Ad> output when needed (and send commands with your approval), check pin rules, and create and update the <Ad>Wiring Guide</Ad>.</Par>
        <Baslik>Context meter</Baslik>
        <Par>As the chat grows, the amount the model can remember fills up. The thin <Ad>Context</Ad> meter under the input box shows how full it is; if it nears full, you can shorten old messages with <Ad>Summarize history</Ad> or start a new chat.</Par>
        <Ipucu tur="dikkat">AI can make mistakes. Especially for board connections and power, read the code it produces before uploading; the pin check and the build give you extra assurance.</Ipucu>
      </>
    )
  },
  {
    id: 'kisayollar',
    baslik: 'Keyboard shortcuts',
    ozet: 'Key combinations for common actions',
    anahtarlar: 'shortcut keyboard key ctrl f1 kısayol klavye tuş',
    icerik: () => (
      <>
        <table className="w-full text-[12.5px]">
          <tbody>
            {[
              [['Ctrl', 'S'], 'Save the open file'],
              [['Ctrl', 'R'], 'Build'],
              [['Ctrl', 'U'], 'Upload to board'],
              [['Ctrl', 'N'], 'New project'],
              [['Ctrl', 'O'], 'Open project'],
              [['Ctrl', 'W'], 'Close the open tab'],
              [['Ctrl', 'Shift', 'M'], 'Toggle the serial monitor'],
              [['Ctrl', 'Shift', 'N'], 'New IDE window'],
              [['Ctrl', 'Space'], 'Open autocomplete suggestions'],
              [['Ctrl', 'Shift', 'Space'], 'Show parameter hint'],
              [['F1'], 'Help'],
              [['Enter'], 'Cloud AI: send the message'],
              [['Esc'], 'Cloud AI: stop the run']
            ].map(([tuslar, aciklama]) => (
              <tr key={aciklama as string} className="border-b border-panel-border/60">
                <td className="w-48 py-2 pr-3">
                  <span className="flex items-center gap-1">
                    {(tuslar as string[]).map((tus, i) => (
                      <span key={tus} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-600">+</span>}
                        <Tus>{tus}</Tus>
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-2 text-gray-300">{aciklama as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Par>
          <span className="mt-3 block">Editor shortcuts (search, multiple cursors, moving lines, etc.) are the same as in VS Code. For example <Tus>Ctrl</Tus>+<Tus>F</Tus> searches and <Tus>Alt</Tus>+<Tus>↑</Tus>/<Tus>↓</Tus> moves a line.</span>
        </Par>
      </>
    )
  },
  {
    id: 'guncelleme',
    baslik: 'Application update',
    ozet: 'How new versions are found and installed',
    anahtarlar: 'update new version download install automatic github release güncelleme güncelle yeni sürüm',
    icerik: () => (
      <>
        <Par>Cloud IDE notices by itself when a new version is released: shortly after startup and then every six hours, the releases page on GitHub is checked. If there is a new version, a blue <Ad>New version</Ad> button appears in the top bar.</Par>
        <Adimlar>
          <Adim no={1}>Click the button; read the release notes.</Adim>
          <Adim no={2}>Press <Ad>Download</Ad>. You can keep using the application while it downloads.</Adim>
          <Adim no={3}>When it finishes, press <Ad>Restart and install</Ad>. If you have unsaved work, save it first. If you don't want to install right away, it is also installed when you close the application.</Adim>
        </Adimlar>
        <Liste>
          <Madde baslik="Never without asking">An update is not downloaded or installed without your approval.</Madde>
          <Madde baslik="Privacy">Only version information is queried; no data about your projects or usage is sent.</Madde>
          <Madde baslik="Turning it off">You can turn off the background check in the Settings › Updates section or look manually with <Ad>Check now</Ad>.</Madde>
          <Madde baslik="Portable version">It cannot update itself; the button takes you to the releases page, and you download the new file from there.</Madde>
        </Liste>
      </>
    )
  },
  {
    id: 'sorunlar',
    baslik: 'Troubleshooting',
    ozet: 'Port not showing, upload failing, arduino-cli not found',
    anahtarlar: 'problem error port not showing upload failed arduino-cli driver ch340 cp210x boot esp32 permission denied busy sorun hata',
    icerik: () => (
      <>
        <Baslik>My board doesn't appear in the port list</Baslik>
        <Liste>
          <Madde>Check the cable: some USB cables are charge-only and carry no data. Try another cable.</Madde>
          <Madde>Cheap clone boards may need the <Ad>CH340</Ad> or <Ad>CP210x</Ad> driver. If the board doesn't appear under "Ports (COM)" in Device Manager, install the driver.</Madde>
          <Madde>Press the refresh button next to the port; unplug the board and plug it in again.</Madde>
        </Liste>
        <Baslik>The upload fails</Baslik>
        <Liste>
          <Madde baslik="Port busy / access denied">Another program (Arduino IDE, another serial terminal) is holding the same port. Close it.</Madde>
          <Madde baslik="ESP32 can't connect">Hold the board's <Ad>BOOT</Ad> button while the upload starts and release it once "Connecting…" has passed.</Madde>
          <Madde baslik="Wrong board selected">The board you select must be the same as the physical board; especially don't mix up ESP32 variants.</Madde>
        </Liste>
        <Baslik>Build error: "…h: No such file or directory"</Baslik>
        <Par>The library you included with <Ad>#include</Ad> is not installed. Search for its name in the <Ad>Library manager</Ad> and install it.</Par>
        <Baslik>"arduino-cli not found" warning</Baslik>
        <Par>When the build engine can't be found, a warning appears at the top. You can show the arduino-cli path manually in <Ad>Settings</Ad> or use the <Ad>Retry</Ad> button in the warning.</Par>
        <Baslik>Meaningless characters in the serial monitor</Baslik>
        <Par>The baud rate doesn't match. Set the rate in the top bar to the <Ad>Serial.begin()</Ad> value in the code (usually 115200 in ESP32 examples).</Par>
        <Baslik>Reporting a problem</Baslik>
        <Par>If you can't solve something or think it is a bug in the application, use the <Ad>Report a problem</Ad> button at the bottom left of the Help window (or Settings › About). It prepares a report containing your Cloud IDE version, your board, installed packages, the last build output and the application log. Your API keys, passwords, e-mail, IP address and user name are hidden automatically; your code is included only if you tick it. You see the whole report in a preview; you can copy it, save it as a file, or open a pre-filled issue on GitHub. Nothing is sent automatically.</Par>
        <Ipucu>If you still can't solve it, you can paste the error text from the <Ad>Output</Ad> tab into Cloud AI and ask "what does this error mean?".</Ipucu>
      </>
    )
  }
]
