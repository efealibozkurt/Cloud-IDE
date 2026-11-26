import type { ReactElement, ReactNode } from 'react'

export type YardimKonuId = 'baslangic' | 'projeler' | 'notlar' | 'kartlar' | 'derleme' | 'seri' | 'pin' | 'gecmis' | 'ai' | 'kisayollar' | 'guncelleme' | 'sorunlar'

export interface YardimKonusu {
  id: YardimKonuId
  baslik: string
  /** Kenar listesinde ve arama sonucunda görünen tek cümlelik özet */
  ozet: string
  /** Aramada eşleşecek ek kelimeler */
  anahtarlar: string
  icerik: () => ReactElement
}

// ───────── küçük yapı taşları ─────────

export function Baslik({ children }: { children: ReactNode }): ReactElement {
  return <h3 className="mb-1.5 mt-5 text-[13px] font-semibold text-gray-100 first:mt-0">{children}</h3>
}

export function Par({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-2 text-[12.5px] leading-relaxed text-gray-400">{children}</p>
}

export function Adimlar({ children }: { children: ReactNode }): ReactElement {
  return <ol className="mb-3 list-none space-y-2">{children}</ol>
}

export function Adim({ no, children }: { no: number; children: ReactNode }): ReactElement {
  return (
    <li className="flex gap-3 text-[12.5px] leading-relaxed text-gray-300">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-panel-border font-mono text-[11px] text-gray-400">{no}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

export function Liste({ children }: { children: ReactNode }): ReactElement {
  return <ul className="mb-3 space-y-1.5 text-[12.5px] leading-relaxed text-gray-400">{children}</ul>
}

export function Madde({ baslik, children }: { baslik?: string; children: ReactNode }): ReactElement {
  return (
    <li className="flex gap-2">
      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-gray-600" aria-hidden="true" />
      <span>
        {baslik && <strong className="font-medium text-gray-200">{baslik}: </strong>}
        {children}
      </span>
    </li>
  )
}

export function Ipucu({ children, tur = 'ipucu' }: { children: ReactNode; tur?: 'ipucu' | 'dikkat' }): ReactElement {
  return (
    <div className={`mb-3 rounded-[6px] border-l-2 px-3 py-2 text-[12px] leading-relaxed ${tur === 'dikkat' ? 'border-amber-400/70 bg-amber-400/[0.06] text-amber-100/90' : 'border-accent bg-accent/[0.08] text-gray-300'}`}>
      {children}
    </div>
  )
}

export function Tus({ children }: { children: ReactNode }): ReactElement {
  return <kbd className="rounded-[4px] border border-panel-border bg-panel px-1.5 py-px font-mono text-[11px] text-gray-200">{children}</kbd>
}

export function Ad({ children }: { children: ReactNode }): ReactElement {
  return <span className="font-medium text-gray-200">{children}</span>
}

// ───────── konular ─────────

export const YARDIM_KONULARI: YardimKonusu[] = [
  {
    id: 'baslangic',
    baslik: 'Hızlı başlangıç',
    ozet: 'İlk programınızı karta yüklemek için 5 adım',
    anahtarlar: 'başla ilk program led yanıp sönme kurulum yükle',
    icerik: () => (
      <>
        <Par>Cloud IDE, Arduino uyumlu kartlara (Arduino, ESP32, Deneyap vb.) program yazıp yüklemeniz için hazırlanmış bir editördür. İlk programınız için:</Par>
        <Adimlar>
          <Adim no={1}>
            <Ad>Yeni proje açın.</Ad> <Tus>Ctrl</Tus>+<Tus>N</Tus> ile boş bir proje oluşur. Hazır bir örnekle başlamak için üst çubuktaki <Ad>Örnekler</Ad> menüsünü kullanın.
          </Adim>
          <Adim no={2}>
            <Ad>Kartınızı seçin.</Ad> Üst çubukta kart seçiciye tıklayın. Listede kartınız yoksa soldaki <Ad>Kart yöneticisi</Ad>nden kartınızın paketini kurun (<Ad>Kartlar ve kütüphaneler</Ad> konusuna bakın).
          </Adim>
          <Adim no={3}>
            <Ad>Kartı bağlayıp portu seçin.</Ad> USB kabloyla bağladığınızda port seçicide yeni bir port (ör. COM3) belirir. Port listesi 3 saniyede bir kendiliğinden yenilenir.
          </Adim>
          <Adim no={4}>
            <Ad>Derleyin.</Ad> <Ad>Derle</Ad> düğmesi (<Tus>Ctrl</Tus>+<Tus>R</Tus>) kodunuzu denetler. Hata varsa altta <Ad>Problems</Ad> sekmesinde satır satır görürsünüz.
          </Adim>
          <Adim no={5}>
            <Ad>Yükleyin.</Ad> <Ad>Yükle</Ad> düğmesi (<Tus>Ctrl</Tus>+<Tus>U</Tus>) önce derler, sonra karta gönderir. Sonucu <Ad>Seri Monitör</Ad>de izleyebilirsiniz.
          </Adim>
        </Adimlar>
        <Par>İlk açılışta kısa bir tur yapılır; sonradan izlemek için bu pencerenin sol altındaki <Ad>Başlangıç turunu yeniden izle</Ad> düğmesini kullanın.</Par>
        <Ipucu>Takıldığınız her yerde bölüm başlıklarındaki <Ad>?</Ad> düğmesi o bölümün yardımını açar. Bu pencereye her zaman <Tus>F1</Tus> ile ulaşabilirsiniz.</Ipucu>
      </>
    )
  },
  {
    id: 'projeler',
    baslik: 'Projeler ve dosyalar',
    ozet: 'Çalışma alanı, birden çok proje, dosya ekleme',
    anahtarlar: 'dosya proje çalışma alanı sketch ino header yeni pencere farklı kaydet otomatik tamamlama intellisense hover imza',
    icerik: () => (
      <>
        <Par>Her proje (sketch), aynı adı taşıyan bir klasördür; ana dosya <Ad>proje_adi.ino</Ad>'dur. Yanına <Ad>.h</Ad>, <Ad>.cpp</Ad> gibi dosyalar ekleyerek kodunuzu bölebilirsiniz.</Par>
        <Baslik>Dosyalar paneli</Baslik>
        <Liste>
          <Madde baslik="Birden çok proje">Aynı pencerede birkaç projeyi birlikte açabilirsiniz. Projeler listesinden birine tıklayarak onu aktif yaparsınız.</Madde>
          <Madde baslik="Derlenecek proje">Birden fazla proje açıksa üst çubukta bir proje seçici çıkar; <Ad>Derle</Ad> ve <Ad>Yükle</Ad> o projeye uygulanır.</Madde>
          <Madde baslik="Sağ tık menüsü">Projeye sağ tıklayarak yeni dosya ekleyebilir, projeyi derleme hedefi yapabilir, yeni pencerede açabilir, <Ad>Farklı kaydet</Ad> ile kopyasını çıkarabilir veya kapatabilirsiniz.</Madde>
          <Madde baslik="Yeni pencere">
            <Tus>Ctrl</Tus>+<Tus>Shift</Tus>+<Tus>N</Tus> ile ayrı bir IDE penceresi açılır; iki ekranda çalışırken kullanışlıdır.
          </Madde>
        </Liste>
        <Baslik>Şablondan proje</Baslik>
        <Par>Sıfırdan başlamak yerine <Ad>Dosyalar</Ad> panelinin başlığındaki <Ad>Şablondan proje</Ad> düğmesini kullanın. LED yanıp sönme, DHT sıcaklık sensörü, ultrasonik mesafe, servo, NeoPixel, OLED ekran, röle ve ESP için web sayfasından LED kontrolü gibi hazır projeler vardır.</Par>
        <Adimlar>
          <Adim no={1}>Önce üst çubuktan <Ad>kartınızı seçin</Ad>; kod seçtiğiniz karta (Arduino, ESP32, ESP8266) göre uyarlanır.</Adim>
          <Adim no={2}>Listeden şablonu seçin, pinleri kendi bağlantınıza göre değiştirin. Hatalı bir pin girerseniz sihirbaz hemen uyarır.</Adim>
          <Adim no={3}>Sağdaki <Ad>Bağlantı</Ad> bölümünde hangi kabloyu nereye takacağınızı görürsünüz. Eksik kütüphaneler tek tıkla kurulur.</Adim>
          <Adim no={4}><Ad>Projeyi oluştur</Ad>'a basın; proje açılır, <Ad>Yükle</Ad> demeniz yeter.</Adim>
        </Adimlar>
        <Baslik>Çevrimdışı kod tamamlama (IntelliSense)</Baslik>
        <Par>Kod editörü; internet bağlantısı ya da harici bir derleyici sunucusu gerektirmeden tamamen çevrimdışı otomatik tamamlama, Türkçe fonksiyon açıklaması ve parametre ipucu sunar.</Par>
        <Liste>
          <Madde baslik="Arduino ve ESP32 API">Yazmaya başladığınızda temel fonksiyonlar (<Ad>pinMode</Ad>, <Ad>digitalWrite</Ad>, <Ad>millis</Ad>…), seçili karta göre pin sabitleri ve hazır kalıplar (<Ad>setup</Ad>, <Ad>loop</Ad>, <Ad>millis_zamanlayici</Ad>) önerilir.</Madde>
          <Madde baslik="Kurulu kütüphaneler ve nesne üyeleri">Bilgisayarınızda kurulu kütüphanelerin başlık dosyaları taranır. <Ad>#include &lt;</Ad> yazarken başlıkları seçebilir, nesne adından sonra <Ad>.</Ad> (<Ad>Serial.</Ad> veya <Ad>sensor.</Ad>) koyduğunuzda sınıfın metotlarını görebilirsiniz.</Madde>
          <Madde baslik="Açıklama ve parametre ipucu">Bir fonksiyonun üzerine fareyle geldiğinizde Türkçe açıklaması ve imzası görünür; parantez <Ad>(</Ad> açtığınızda o an doldurduğunuz parametre vurgulanır.</Madde>
        </Liste>
        <Baslik>Kaydetme</Baslik>
        <Par>
          <Tus>Ctrl</Tus>+<Tus>S</Tus> açık dosyayı kaydeder; <Ad>Derle</Ad> ve <Ad>Yükle</Ad> kaydedilmemiş dosyaları kendileri kaydeder. Kaydedilmemiş sekmelerde ad yanında bir nokta görürsünüz.
        </Par>
        <Ipucu tur="dikkat">Örnekler menüsünden açtığınız kodlar salt örnektir. Değişikliklerinizi korumak için önce projeye sağ tıklayıp <Ad>Farklı kaydet (kopya oluştur)</Ad> ile kendi klasörünüze kopyalayın.</Ipucu>
        <Par>Projeleriniz varsayılan olarak <Ad>Belgelerim › Cloud_IDE_Sketches</Ad> klasöründe tutulur.</Par>
      </>
    )
  },
  {
    id: 'notlar',
    baslik: 'Proje notları',
    ozet: 'Bağlantılar, parça listesi ve yapılacaklar',
    anahtarlar: 'not notlar yapılacak liste bağlantı parça todo md',
    icerik: () => (
      <>
        <Par>Elektronik projelerde kodun yanında "hangi kabloyu nereye taktım?" bilgisi de önemlidir. Soldaki çubuktaki <Ad>Proje notları</Ad> simgesi her projeye bir not defteri verir.</Par>
        <Liste>
          <Madde baslik="Yazarken kaydedilir">Ayrıca bir düğmeye basmanız gerekmez.</Madde>
          <Madde baslik="Onay kutuları">Satır başına <Ad>- [ ]</Ad> yazarsanız Önizle görünümünde tıklayıp işaretleyebileceğiniz bir yapılacaklar listesi olur; üstte kaç tanesinin bittiği görünür.</Madde>
          <Madde baslik="Şablonla başla">Kullanılan parçalar, bağlantılar ve yapılacaklar başlıklarını hazır getirir.</Madde>
          <Madde baslik="Koddan doldur">Kodda kullandığınız kütüphaneleri, pinleri ve seçili kartı notlara ekler. Pin numarasını ne için kullandığınızı unutmamanın en kolay yolu.</Madde>
        </Liste>
        <Ipucu>Notlar projenin klasöründe <Ad>NOTLAR.md</Ad> adlı düz bir dosyadır. Sürüm geçmişine ve .zip paketine kodla birlikte girer; yani eski bir sürüme döndüğünüzde o günün notlarına da dönersiniz.</Ipucu>
      </>
    )
  },
  {
    id: 'kartlar',
    baslik: 'Kartlar ve kütüphaneler',
    ozet: 'Kart paketi ve kütüphane kurma, örnekler',
    anahtarlar: 'kart yöneticisi kütüphane yöneticisi çekirdek core paket kur sil esp32 arduino deneyap servo',
    icerik: () => (
      <>
        <Baslik>Kart yöneticisi</Baslik>
        <Par>Bir kartı kullanabilmek için önce üreticisinin <Ad>kart paketi</Ad> (çekirdek) kurulu olmalıdır. Soldaki çubukta çip simgesine tıklayın:</Par>
        <Adimlar>
          <Adim no={1}>Listeden paketi bulun (ör. <Ad>esp32</Ad>, <Ad>Arduino AVR Boards</Ad>, <Ad>Deneyap</Ad>); kart fotoğraflarından da tanıyabilirsiniz.</Adim>
          <Adim no={2}><Ad>Kur</Ad>'a basın. İndirme boyuta göre birkaç dakika sürebilir; ilerlemeyi <Ad>Çıktı</Ad> sekmesinde görürsünüz.</Adim>
          <Adim no={3}>Kurulum bitince kartınız üst çubuktaki kart seçicide görünür.</Adim>
        </Adimlar>
        <Baslik>Kütüphane yöneticisi</Baslik>
        <Par>Kütüphaneler sensör, ekran, motor gibi donanımlar için hazır kod sağlar. Kitap simgesine tıklayın, arama kutusuna adını yazın (ör. <Ad>Servo</Ad>, <Ad>DHT</Ad>, <Ad>Adafruit NeoPixel</Ad>) ve <Ad>Kur</Ad>'a basın. Kurduktan sonra kodunuza <Ad>#include &lt;Kutuphane.h&gt;</Ad> satırını eklersiniz.</Par>
        <Baslik>Kart ayarları</Baslik>
        <Par>Bazı kartların ek seçenekleri vardır: Nano için işlemci ("Old Bootloader"), ESP32 için bölüm şeması, CPU hızı ve yükleme hızı gibi. Böyle bir kart seçiliyken kart seçicinin yanında küçük bir <Ad>Kart ayarları</Ad> düğmesi belirir (Arduino IDE'deki Araçlar menüsünün karşılığı). Yükleme "not in sync" gibi hatalarla kesiliyorsa önce buraya bakın. Ayarlar kart için hatırlanır; Cloud AI'ın derlemeleri de aynı ayarları kullanır.</Par>
        <Baslik>Kart tanıma</Baslik>
        <Par>Bir kartı USB'ye taktığınızda, kart paketi kuruluysa üstte <Ad>Bu kartı kullan</Ad> önerisi çıkar. Kart tanınamazsa USB çipinden (CH340, CP210x, FTDI…) ne tür bir kart olabileceği söylenir.</Par>
        <Baslik>Kütüphane güncellemeleri</Baslik>
        <Par>Kurduğunuz kütüphanelerin daha yeni sürümü çıkınca Kütüphane yöneticisi simgesinde sayı rozeti belirir; panelin üstündeki mavi bantta liste ve <Ad>Tümünü güncelle</Ad> düğmesi vardır. Yeni sürüm bazen işlevleri değiştirebilir; güncelledikten sonra projenizi derleyip deneyin. Sürüm geçmişi hangi sürümle derlediğinizi kaydettiği için gerekirse eski haline dönebilirsiniz.</Par>
        <Baslik>Örnekler</Baslik>
        <Par>Üst çubuktaki <Ad>Örnekler</Ad> menüsü, kurduğunuz kart ve kütüphanelerin hazır örneklerini listeler. Yeni bir kütüphaneyi denemenin en kolay yolu önce örneğini açıp çalıştırmaktır.</Par>
        <Ipucu>Arduino IDE ile aynı kart ve kütüphane kaynaklarını kullanır; daha önce kurduklarınızı yeniden indirmeniz gerekmez.</Ipucu>
      </>
    )
  },
  {
    id: 'derleme',
    baslik: 'Derleme ve yükleme',
    ozet: 'Derle ile Yükle farkı, çıktı, hatalar ve bellek çubuğu',
    anahtarlar: 'derle yükle hata uyarı problems çıktı flash ram bellek boyut',
    icerik: () => (
      <>
        <Liste>
          <Madde baslik="Derle"><Tus>Ctrl</Tus>+<Tus>R</Tus>. Kodu makine koduna çevirir ve hataları arar; karta hiçbir şey göndermez. Kodunuzu denemek için güvenlidir.</Madde>
          <Madde baslik="Yükle"><Tus>Ctrl</Tus>+<Tus>U</Tus>. Önce derler, hatasız bitince karta gönderir. Kart bağlı ve port seçili olmalıdır.</Madde>
        </Liste>
        <Baslik>Alt panel</Baslik>
        <Liste>
          <Madde baslik="Çıktı">Derleyicinin ve yükleyicinin canlı kayıtları. Bir şey ters giderse nedeni burada yazar.</Madde>
          <Madde baslik="Problems">Hata ve uyarılar satır numarasıyla listelenir; birine tıklayınca editörde o satıra gidilir. Derleme hatayla biterse bu sekme kendiliğinden açılır.</Madde>
          <Madde baslik="Pin denetimi">Pin kullanımınızı karta göre kontrol eder (ayrı konuya bakın).</Madde>
        </Liste>
        <Baslik>Derleme hatası aldığınızda</Baslik>
        <Liste>
          <Madde baslik="Açıkla">Problems'taki her hatanın yanındaki düğme, hatayı ve çevresindeki kodu Cloud AI paneline hazırlar; nedenini ve çözümü anlatmasını isteyebilirsiniz.</Madde>
          <Madde baslik="Eksik kütüphane">“…h: No such file or directory” hatasında altta kurulabilecek kütüphane önerilir. <Ad>Kur ve derle</Ad> kütüphaneyi indirip derlemeyi yeniden başlatır.</Madde>
        </Liste>
        <Baslik>Flash ve RAM çubukları</Baslik>
        <Par>Başarılı bir derlemeden sonra alt panelin sağında iki çubuk görünür:</Par>
        <Liste>
          <Madde baslik="Flash">Programınızın kartın program belleğinin yüzde kaçını kapladığı.</Madde>
          <Madde baslik="RAM">Değişkenlerin kartın çalışma belleğinin yüzde kaçını kullandığı.</Madde>
        </Liste>
        <Par>Çubuk %85'ten sonra sarıya, %95'ten sonra kırmıza döner. RAM dolmaya yaklaşırsa program tuhaf davranabilir; uzun metinleri <Ad>F()</Ad> makrosuyla flash'ta tutmak yardımcı olur.</Par>
        <Ipucu>Her başarılı derleme, o sürümün hangi kart ve kütüphane sürümleriyle derlendiğini <Ad>Sürüm geçmişi</Ad>ne de işler.</Ipucu>
      </>
    )
  },
  {
    id: 'seri',
    baslik: 'Seri monitör',
    ozet: 'Karttan gelen verileri izleme, birden çok port',
    anahtarlar: 'seri monitör serial baud port bağlan zaman damgası bootloader çoklu iki kart println',
    icerik: () => (
      <>
        <Par>Kodunuzdaki <Ad>Serial.println()</Ad> çıktılarını görmenin ve karta komut göndermenin yoludur. Üst çubuktaki <Ad>Seri Monitör</Ad> düğmesiyle (<Tus>Ctrl</Tus>+<Tus>Shift</Tus>+<Tus>M</Tus>) açılır.</Par>
        <Adimlar>
          <Adim no={1}>Üst çubuktan portu ve <Ad>baud hızını</Ad> seçin. Baud, kodunuzdaki <Ad>Serial.begin(…)</Ad> değeriyle aynı olmalıdır; aksi halde anlamsız karakterler görürsünüz. Kodda <Ad>Serial.begin(9600)</Ad> gibi tek bir hız varsa IDE baud seçimini kendisi buna ayarlar.</Adim>
          <Adim no={2}><Ad>Bağlan</Ad>'a tıklayın. Gelen satırlar akmaya başlar.</Adim>
          <Adim no={3}>Alttaki kutuya yazıp <Tus>Enter</Tus> ile gönderin. Satır sonu seçimi (NL, CR, NL+CR) karttaki kodun beklentisine göre ayarlanır.</Adim>
        </Adimlar>
        <Baslik>Nerede görünsün?</Baslik>
        <Par>Seri monitör varsayılan olarak editörün sağında açılır; genişliğini sol kenarından sürükleyebilirsiniz. Başlığındaki düğmelerle alt panele alabilir ya da tam ekran yapabilirsiniz; son seçtiğiniz konum hatırlanır. Tam ekranda <Ad>İkisi</Ad> görünümü metni ve grafiği yan yana gösterir, <Tus>Esc</Tus> ile çıkılır. Cloud AI da açıksa sağdaki alanda sekmeyle geçersiniz.</Par>
        <Baslik>Hangi port benim kartım?</Baslik>
        <Par>Üst çubuktaki port listesinde kart olabilecek portlar <Ad>Kartınız</Ad> başlığında, bilgisayarın kendi portu ve Bluetooth portları <Ad>Diğer portlar</Ad> başlığında görünür. Kartı taktığınızda portu kendiliğinden seçilir. Kart <Ad>Kartınız</Ad> altında hiç çıkmıyorsa kablo yalnızca şarj kablosu olabilir ya da USB sürücüsü (CH340, CP210x) eksiktir.</Par>
        <Baslik>Birden çok kartı aynı anda izleme</Baslik>
        <Par>Bir port bağlıyken durum yazısının yanındaki <Ad>+</Ad> (Port ekle) düğmesine basıp listeden ikinci portu seçin; üst çubuktaki baud hızıyla bağlanır. Diğer bağlantılar açık kalır; üstte her port için ayrı sekme ve <Ad>Tümü</Ad> sekmesi çıkar. <Ad>Tümü</Ad> görünümünde her satırın başında hangi porttan geldiği renkli etiketle yazar. Gönderme, temizleme ve kesme işlemleri seçili sekmeye uygulanır.</Par>
        <Baslik>Grafik görünümü</Baslik>
        <Par>Üstteki <Ad>Metin / Grafik</Ad> anahtarıyla gelen sayıları canlı çizgi grafiğe çevirebilirsiniz; sensör değerlerini ayarlarken çok işe yarar. Kodda şu biçimlerden birini yazdırın:</Par>
        <Liste>
          <Madde><Ad>Serial.println(deger);</Ad> tek çizgi</Madde>
          <Madde><Ad>10,20,30</Ad> (virgül ya da boşlukla ayrılmış) birden çok çizgi</Madde>
          <Madde><Ad>sicaklik:23.5 nem:60</Ad> adlandırılmış çizgiler; adlar grafiğin üstünde görünür, üzerine tıklayarak bir çizgiyi gizleyebilirsiniz</Madde>
        </Liste>
        <Par>Pencere seçiciyle kaç örneğin görüneceğini, <Ad>Duraklat</Ad> ile akışı dondurmayı ayarlarsınız.</Par>
        <Baslik>Yararlı seçenekler</Baslik>
        <Par>İlk üçü, ayar çizgileri simgeli <Ad>Görünüm seçenekleri</Ad> menüsündedir.</Par>
        <Liste>
          <Madde baslik="Saati göster">Her satırın başına saat ekler.</Madde>
          <Madde baslik="Otomatik kaydır">En yeni satırı hep gösterir; yukarı kaydırınca kendiliğinden kapanır.</Madde>
          <Madde baslik="Açılış mesajlarını gizle">ESP32'nin açılışta bastığı teknik satırları (rst:, load:, entry …) soluklaştırıp süzer.</Madde>
          <Madde baslik="AI'a Sor ve hata vurgusu">ESP32 çökme, Watchdog (WDT) veya güç düşümü (Brownout) satırları kırmızıyla vurgulanır. Üstteki <Ad>AI'a Sor</Ad> düğmesi son çıktıyı doğrudan Cloud AI'a gönderir; ayrıca asistan çalışırken açık seri portu kendisi de okuyabilir.</Madde>
        </Liste>
        <Ipucu>Yükleme sırasında ilgili port kısa süre kendiliğinden kapatılır ve yükleme bitince yeniden açılır. Bu sırada "Yükleme için geçici kapatıldı" yazar; endişelenmeyin.</Ipucu>
      </>
    )
  },
  {
    id: 'pin',
    baslik: 'Pin denetimi',
    ozet: 'Pin hatalarını kod çalışmadan yakalama',
    anahtarlar: 'pin denetim gpio pwm servo kesme flash adc2 çakışma uyarı kart',
    icerik: () => (
      <>
        <Par>Alt paneldeki <Ad>Pin denetimi</Ad> sekmesi kodunuzu okur ve <Ad>seçili karta göre</Ad> pin kullanımınızdaki yaygın hataları gösterir. Siz yazarken kendiliğinden güncellenir; kartı değiştirdiğinizde sonuç da değişir.</Par>
        <Baslik>Neleri yakalar</Baslik>
        <Liste>
          <Madde baslik="Kartta olmayan pin">Örneğin Uno'da <Ad>pinMode(30, OUTPUT)</Ad>.</Madde>
          <Madde baslik="PWM desteklemeyen pinde analogWrite">Uno'da yalnızca 3, 5, 6, 9, 10, 11 numaralı pinler PWM yapar.</Madde>
          <Madde baslik="Kesme pini olmayan pin">Uno'da <Ad>attachInterrupt</Ad> yalnızca 2 ve 3'te çalışır.</Madde>
          <Madde baslik="ESP32'ye özgü">6–11 numaralı pinler flash belleğe bağlıdır (kullanılmaz); 34–39 yalnızca giriştir; Wi-Fi açıkken ADC2 pinlerinde <Ad>analogRead</Ad> çalışmaz; 0, 2, 5, 12, 15 açılışı etkileyebilir.</Madde>
          <Madde baslik="Çakışmalar">Aynı pine hem servo hem başka bir işlev bağlamak, iki servoyu aynı pine bağlamak, <Ad>pinMode</Ad> çağrısı olmadan <Ad>digitalWrite</Ad> kullanmak, Serial kullanırken 0/1 pinlerini kullanmak.</Madde>
        </Liste>
        <Baslik>Kart pin haritası</Baslik>
        <Par>Sekmede seçili kartın tüm pinleri küçük kutular olarak çizilir; her kutudaki renkli noktalar pinin ne yapabildiğini (PWM, analog, kesme, I2C, SPI…) gösterir. Kodunuzda kullandığınız pinler mavi çerçeveyle işaretlenir; bir pinin üzerine gelince tüm özellikleri ve koddaki rolü yazar. Kırmızı üstü çizili pinler flash belleğe bağlıdır, kullanmayın. Harita Arduino Uno/Nano/Mega, ESP32 ve ESP8266 için vardır.</Par>
        <Baslik>Sekmede ne görürsünüz</Baslik>
        <Par>Üstte durum satırı (kaç dosya tarandı, hangi kartın kuralları uygulandı), ardından bulgular; bir bulguya tıklayınca editörde o satıra gidilir. En altta kodda kullandığınız tüm pinlerin rollerini gösteren bir tablo vardır; kablolama yaparken bu tabloya bakabilirsiniz.</Par>
        <Baslik>Bağlantı Kılavuzu sekmesi</Baslik>
        <Par>Alt paneldeki <Ad>Bağlantı Kılavuzu</Ad> sekmesi kodunuzdan kullandığınız sensör, ekran, motor ve pinleri okuyarak etkileşimli bir kablolama şeması çıkarır. 3.3V / 5V mantık uyumu ve eksik direnç uyarılarını gösterir; <Ad>AI ile Oluştur</Ad> düğmesiyle Cloud AI'ın kılavuzu derinleştirip proje içine kaydetmesini sağlayabilir, <Ad>Bağladım</Ad> onay kutularıyla kablolama adımlarınızı takip edebilirsiniz.</Par>
        <Ipucu tur="dikkat">Bu bir ön kontroldür, derleyici değildir. Pin numarası bir değişkenle hesaplanıyorsa denetlenemez ve atlanır. Özel kuralları şimdilik Arduino Uno/Nano/Mega, ESP32 ve ESP8266 için vardır; diğer kartlarda yalnızca çakışma kontrolleri çalışır. Üst çubuktan kart seçmezseniz kart kuralları uygulanamaz.</Ipucu>
      </>
    )
  },
  {
    id: 'gecmis',
    baslik: 'Sürüm geçmişi',
    ozet: 'Projenizin eski hallerine dönün, deney yapın, yedekleyin',
    anahtarlar: 'sürüm geçmişi geri yükle fark etiket dal commit yedek zip paket git eski kod',
    icerik: () => (
      <>
        <Par>Sürüm geçmişi, projenizin zaman içindeki hallerini saklar. "Dün çalışıyordu, şimdi bozuldu" durumunda eski sürüme dönebilir, iki hal arasındaki farkı görebilirsiniz. Soldaki çubuktaki <Ad>Sürüm geçmişi</Ad> simgesinden açılır ve aktif projeye uygulanır.</Par>
        <Baslik>Temel kullanım</Baslik>
        <Adimlar>
          <Adim no={1}>Kodunuzun çalıştığı bir anda <Ad>Sürüm kaydet</Ad>'e basın. İsterseniz kısa bir not yazın ("LED hızı ayarlandı").</Adim>
          <Adim no={2}>Üstteki durum satırı, son kayıttan beri kaç dosyanın değiştiğini gösterir. <Ad>Değişiklikleri gör</Ad> farkı açar.</Adim>
          <Adim no={3}>Listedeki bir sürümde <Ad>Şu ankiyle karşılaştır</Ad> o günden bugüne neyin değiştiğini gösterir; <Ad>⋯</Ad> menüsündeki <Ad>Bu sürümde ne değişti?</Ad> bir önceki kayıtla karşılaştırır.</Adim>
          <Adim no={4}><Ad>Geri yükle</Ad> o sürümdeki dosyaları geri getirir. Bugünkü hal önce "geri yükleme öncesi" diye otomatik saklanır, yani pişman olursanız bu da geri alınabilir.</Adim>
        </Adimlar>
        <Baslik>Otomatik kayıtlar</Baslik>
        <Par>Siz bir şey yapmasanız da şu anlarda anlık görüntü alınır: kaydetmeden önce (en çok 2 dakikada bir), Cloud AI dosyalara dokunmadan önce ve kod değiştiyse derlerken. Bunlar listede "otomatik", "yapay zekâ öncesi" veya "derleme" olarak görünür. Otomatik kayıt sayısı sınırlıdır (varsayılan 50); elle kaydettikleriniz ve etiketlediğiniz sürümler hiçbir zaman silinmez. Ayarlar'daki <Ad>Sürüm geçmişi</Ad> bölümünden kapatabilir veya sınırı değiştirebilirsiniz.</Par>
        <Baslik>Derleme bilgisi</Baslik>
        <Par>Derlenmiş sürümlerde yeşil nokta, kullanılan Flash/RAM oranı ve bir önceki derlemeye göre flash farkı görünür. Eski bir sürüme dönerken, o sürüm farklı bir kart ya da kütüphane sürümüyle derlenmişse uyarılırsınız. Derleme hatası aldıysanız panelin üstündeki <Ad>son derlenen sürümden bu yana ne değişti</Ad> bağlantısı sorunun nerede çıktığını bulmanıza yardım eder.</Par>
        <Baslik>İsim verme ve deneme</Baslik>
        <Liste>
          <Madde baslik="İsim ver">Önemli bir sürüme ad verir ("v1.0", "fuara-giden"). Listede çerçeve içinde görünür.</Madde>
          <Madde baslik="Buradan deneme başlat">Bir sürümden ayrı bir deneme yolu açar; ana kodunuz bozulmaz. Deneme açıkken panelin üstünde sarı bir şerit görünür; <Ad>Ana koda dön</Ad> ile geri geçer, <Ad>Denemeyi sil</Ad> ile atarsınız. (Şimdilik denemeyi ana koda birleştirme yoktur.)</Madde>
        </Liste>
        <Baslik>Yedekleme ve paylaşma</Baslik>
        <Par>Panelin altındaki <Ad>Paketle (.zip)</Ad> projeyi tüm geçmişiyle tek bir dosyaya yazar; <Ad>İçe aktar</Ad> böyle bir paketi başka bilgisayarda yeni proje olarak açar.</Par>
        <Ipucu>Geçmiş, projenin kendi klasöründe gizli bir <Ad>.history</Ad> klasöründe durur. Projeyi taşırsanız geçmişi de birlikte gelir; klasörü silerseniz geçmiş de silinir.</Ipucu>
      </>
    )
  },
  {
    id: 'ai',
    baslik: 'Cloud AI asistanı',
    ozet: 'Kod yazdıran, hata düzelten yapay zekâ ve güvenli kullanımı',
    anahtarlar: 'ai yapay zeka asistan cloud api anahtarı izin onay geri al model ollama lm studio bilgi tabanı bağlam',
    icerik: () => (
      <>
        <Par>Cloud AI, projenizi okuyabilen, kod yazabilen, derleyip hataları düzeltebilen bir asistandır. Üst çubuktaki <Ad>Cloud AI</Ad> düğmesiyle sağda açılır.</Par>
        <Baslik>İlk kurulum</Baslik>
        <Adimlar>
          <Adim no={1}>Sağ üstteki dişli simgesiyle <Ad>Ayarlar › Yapay Zekâ</Ad>'ya girin, bir sağlayıcı seçin ve API anahtarınızı yapıştırın. Anahtar yalnızca bu bilgisayarda, işletim sistemi tarafından şifrelenerek saklanır.</Adim>
          <Adim no={2}>İnternet istemiyorsanız <Ad>Ollama</Ad> veya <Ad>LM Studio</Ad> ile bilgisayarınızda çalışan yerel bir model kullanabilirsiniz; anahtar gerekmez.</Adim>
          <Adim no={3}>Sohbet kutusunun altındaki model adına tıklayıp sağlayıcıyı, modeli ve düşünme düzeyini seçin; sonra kutuya isteğinizi yazıp <Tus>Enter</Tus> ile gönderin ("D13'teki LED'i saniyede bir yak söndür").</Adim>
        </Adimlar>
        <Ipucu>Listede olmayan bir servis (OpenRouter, Groq, Mistral gibi OpenAI uyumlu olanlar) kullanmak için aynı yerdeki <Ad>+ Sağlayıcı ekle</Ad> düğmesine basın.</Ipucu>
        <Baslik>Değişiklik izni: kontrol sizde</Baslik>
        <Par>Giriş kutusunun yanındaki kalkan simgesinden asistanın ne kadar özgür olduğunu seçersiniz:</Par>
        <Liste>
          <Madde baslik="Onaylı (önerilen)">Dosya yazmadan önce neyin değişeceğini farkıyla gösterir. <Ad>Uygula</Ad> veya <Ad>Reddet</Ad> dersiniz.</Madde>
          <Madde baslik="Yarı otomatik">Dosyaları kendi yazar; silme, yeniden adlandırma ve kütüphane kurma gibi işleri yine sorar.</Madde>
          <Madde baslik="Tam otomatik">Hiçbir şey sormaz. Yine de değişiklikler geri alınabilir.</Madde>
        </Liste>
        <Par>Asistan işini bitirince yanıtın altındaki <Ad>Değişiklikleri geri al</Ad> bağlantısıyla o yanıttaki tüm dosya değişikliklerini tek tıkla eski haline döndürebilirsiniz. Ayrıca asistan çalışmadan önce projenizin anlık görüntüsü <Ad>Sürüm geçmişi</Ad>ne de alınır.</Par>
        <Baslik>Seçili kodla çalışma</Baslik>
        <Par>Editörde bir kodu fare ile seçince üstünde küçük bir araç çubuğu çıkar: <Ad>AI ile Düzelt</Ad> seçili kodu düzeltmesini ister, <Ad>Açıkla</Ad> ne yaptığını satır satır, yeni başlayanlara uygun Türkçe anlattırır (kodu değiştirmez), <Ad>Prompt Gir</Ad> seçili kodu panele ekleyip kendi isteğinizi yazmanızı sağlar. Üçünde de istem panele hazırlanır; göndermek için <Tus>Enter</Tus>'a basarsınız.</Par>
        <Baslik>Bilgi tabanı ve donanım araçları</Baslik>
        <Par>Panel altındaki <Ad>Donanım ve bilgi tabanı</Ad>, asistanın kullandığı kart bilgilerini, kütüphane belgelerini ve sizin ekleyebileceğiniz özel notları gösterir. Ayrıca asistan gerektiğinde açık <Ad>Seri Monitör</Ad> çıktısını okuyabilir (onayınızla komut gönderebilir), pin kurallarını denetleyebilir ve <Ad>Bağlantı Kılavuzu</Ad>nu oluşturup güncelleyebilir.</Par>
        <Baslik>Bağlam göstergesi</Baslik>
        <Par>Sohbet uzadıkça modelin hatırlayabildiği miktar dolar. Giriş kutusu altındaki ince <Ad>Bağlam</Ad> göstergesi doluluğu gösterir; dolmaya yaklaşırsa <Ad>Geçmişi özetle</Ad> ile eski mesajları kısaltabilir veya yeni sohbet başlatabilirsiniz.</Par>
        <Ipucu tur="dikkat">Yapay zekâ hata yapabilir. Özellikle kart bağlantıları ve güç konusunda ürettiği kodu yüklemeden önce okuyun; pin denetimi ve derleme size ek güvence sağlar.</Ipucu>
      </>
    )
  },
  {
    id: 'kisayollar',
    baslik: 'Klavye kısayolları',
    ozet: 'Sık kullanılan işlemler için tuş kombinasyonları',
    anahtarlar: 'kısayol klavye tuş ctrl f1',
    icerik: () => (
      <>
        <table className="w-full text-[12.5px]">
          <tbody>
            {[
              [['Ctrl', 'S'], 'Açık dosyayı kaydet'],
              [['Ctrl', 'R'], 'Derle'],
              [['Ctrl', 'U'], 'Karta yükle'],
              [['Ctrl', 'N'], 'Yeni proje'],
              [['Ctrl', 'O'], 'Proje aç'],
              [['Ctrl', 'W'], 'Açık sekmeyi kapat'],
              [['Ctrl', 'Shift', 'M'], 'Seri monitörü aç/kapat'],
              [['Ctrl', 'Shift', 'N'], 'Yeni IDE penceresi'],
              [['Ctrl', 'Space'], 'Otomatik tamamlama önerilerini aç'],
              [['Ctrl', 'Shift', 'Space'], 'Parametre ipucunu göster'],
              [['F1'], 'Yardım'],
              [['Enter'], 'Cloud AI: mesajı gönder'],
              [['Esc'], 'Cloud AI: çalışmayı durdur']
            ].map(([tuslar, aciklama]) => (
              <tr key={aciklama as string} className="border-b border-panel-border/60">
                <td className="w-48 py-2 pr-3">
                  <span className="flex items-center gap-1">
                    {(tuslar as string[]).map((t, i) => (
                      <span key={t} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-600">+</span>}
                        <Tus>{t}</Tus>
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
          <span className="mt-3 block">Editör kısayolları (arama, çoklu imleç, satır taşıma vb.) VS Code ile aynıdır. Örneğin <Tus>Ctrl</Tus>+<Tus>F</Tus> arar, <Tus>Alt</Tus>+<Tus>↑</Tus>/<Tus>↓</Tus> satırı taşır.</span>
        </Par>
      </>
    )
  },
  {
    id: 'guncelleme',
    baslik: 'Uygulama güncellemesi',
    ozet: 'Yeni sürümler nasıl bulunur ve kurulur',
    anahtarlar: 'güncelleme güncelle yeni sürüm indir kur otomatik github release',
    icerik: () => (
      <>
        <Par>Cloud IDE yeni bir sürüm yayınlandığında bunu kendiliğinden fark eder: açılıştan kısa süre sonra ve sonra altı saatte bir, GitHub'daki sürümler sayfasına bakılır. Yeni sürüm varsa üst çubukta mavi bir <Ad>Yeni sürüm</Ad> düğmesi belirir.</Par>
        <Adimlar>
          <Adim no={1}>Düğmeye tıklayın; sürüm notlarını okuyun.</Adim>
          <Adim no={2}><Ad>İndir</Ad>'e basın. İndirme sürerken uygulamayı kullanmaya devam edebilirsiniz.</Adim>
          <Adim no={3}>Bitince <Ad>Yeniden başlat ve kur</Ad>'a basın. Kaydedilmemiş çalışmanız varsa önce kaydedin. Hemen kurmak istemezseniz uygulamayı kapattığınızda da kurulur.</Adim>
        </Adimlar>
        <Liste>
          <Madde baslik="Hiçbir şey sormadan olmaz">Güncelleme siz onaylamadan indirilmez ve kurulmaz.</Madde>
          <Madde baslik="Gizlilik">Yalnızca sürüm bilgisi sorgulanır; projeleriniz ya da kullanımınızla ilgili hiçbir veri gönderilmez.</Madde>
          <Madde baslik="Kapatmak">Ayarlar › Güncelleme bölümünden arka plan denetimini kapatabilir veya <Ad>Şimdi denetle</Ad> ile elle bakabilirsiniz.</Madde>
          <Madde baslik="Taşınabilir (portable) sürüm">Kendini güncelleyemez; düğme sizi sürümler sayfasına götürür, yeni dosyayı oradan indirirsiniz.</Madde>
        </Liste>
      </>
    )
  },
  {
    id: 'sorunlar',
    baslik: 'Sorun giderme',
    ozet: 'Port görünmüyor, yükleme başarısız, arduino-cli bulunamadı',
    anahtarlar: 'sorun hata port görünmüyor yükleme başarısız arduino-cli sürücü ch340 cp210x boot esp32 izin denied meşgul',
    icerik: () => (
      <>
        <Baslik>Port listesinde kartım görünmüyor</Baslik>
        <Liste>
          <Madde>Kabloyu kontrol edin: bazı USB kablolar yalnızca şarj içindir, veri taşımaz. Başka bir kablo deneyin.</Madde>
          <Madde>Ucuz klon kartlarda <Ad>CH340</Ad> ya da <Ad>CP210x</Ad> sürücüsü gerekebilir. Aygıt Yöneticisi'nde "Bağlantı Noktaları (COM)" altında kart görünmüyorsa sürücüyü kurun.</Madde>
          <Madde>Portun yanındaki yenile düğmesine basın; kartı çıkarıp yeniden takın.</Madde>
        </Liste>
        <Baslik>Yükleme başarısız oluyor</Baslik>
        <Liste>
          <Madde baslik="Port meşgul / erişim reddedildi">Başka bir program (Arduino IDE, başka bir seri terminal) aynı portu tutuyordur. Onu kapatın.</Madde>
          <Madde baslik="ESP32 bağlanamıyor">Yükleme başlarken kartın <Ad>BOOT</Ad> düğmesine basılı tutun, "Connecting…" yazısı geçince bırakın.</Madde>
          <Madde baslik="Yanlış kart seçili">Seçtiğiniz kart fiziksel kartla aynı olmalı; özellikle ESP32 türevlerini birbirine karıştırmayın.</Madde>
        </Liste>
        <Baslik>Derleme hatası: "…h: No such file or directory"</Baslik>
        <Par>Kodunuzda <Ad>#include</Ad> ile çağırdığınız kütüphane kurulu değildir. <Ad>Kütüphane yöneticisi</Ad>nden adını aratıp kurun.</Par>
        <Baslik>"arduino-cli bulunamadı" uyarısı</Baslik>
        <Par>Derleme motoru bulunamadığında üstte bir uyarı çıkar. <Ad>Ayarlar</Ad>'dan arduino-cli yolunu elle gösterebilir ya da uyarıdaki <Ad>Yeniden dene</Ad> düğmesini kullanabilirsiniz.</Par>
        <Baslik>Seri monitörde anlamsız karakterler</Baslik>
        <Par>Baud hızı uyuşmuyordur. Üst çubuktaki hızı koddaki <Ad>Serial.begin()</Ad> değerine eşitleyin (ESP32 örneklerinde genellikle 115200).</Par>
        <Baslik>Sorun bildirmek</Baslik>
        <Par>Çözemediğiniz ya da uygulamanın hatası olduğunu düşündüğünüz bir durumda Yardım penceresinin sol altındaki <Ad>Sorun bildir</Ad> düğmesini (ya da Ayarlar › Hakkında) kullanın. Cloud IDE sürümünüzü, kartınızı, kurulu paketleri, son derleme çıktısını ve uygulama günlüğünü içeren bir rapor hazırlar. API anahtarı, parola, e-posta, IP adresi ve kullanıcı adınız otomatik gizlenir; kodunuz yalnızca siz işaretlerseniz eklenir. Raporun tamamını önizlemede görürsünüz; kopyalayabilir, dosya olarak kaydedebilir ya da GitHub'da hazır doldurulmuş bir sorun açabilirsiniz. Hiçbir şey kendiliğinden gönderilmez.</Par>
        <Ipucu>Hâlâ çözemediyseniz, <Ad>Çıktı</Ad> sekmesindeki hata metnini Cloud AI'a yapıştırıp "bu hata ne demek?" diye sorabilirsiniz.</Ipucu>
      </>
    )
  }
]

export function konuBul(id: YardimKonuId): YardimKonusu {
  return YARDIM_KONULARI.find((k) => k.id === id) ?? YARDIM_KONULARI[0]
}
