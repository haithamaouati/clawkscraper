const Eyas = {
    state: { data: null, countries: new Map(), languages: new Map() },
    proxy: "https://corsproxy.io/?",
    worldMap: null,
    counterNamespace: "eyas_scraper_v2_2026", 
    counterKey: "hits"
};

async function init() {
    updateGlobalCounter();
    setupAvatarDownload();
    try {
        const [c, l, m] = await Promise.all([
            fetch('countries.json'), fetch('languages.json'), fetch('world.svg')
        ]);
        const countries = await c.json();
        countries.forEach(x => Eyas.state.countries.set(x.code.toUpperCase(), x));
        const languages = await l.json();
        languages.forEach(x => Eyas.state.languages.set(x.code.toLowerCase(), x.name));
        
        const svgText = await m.text();
        const wrapper = document.getElementById('world-map-wrapper');
        wrapper.innerHTML = svgText;
        Eyas.worldMap = wrapper.querySelector('svg');
    } catch (e) { console.error("INIT_ERR", e); }
}

async function updateGlobalCounter() {
    const el = document.getElementById('visitor-count');
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/${Eyas.counterNamespace}/${Eyas.counterKey}`);
        const data = await res.json();
        el.textContent = data.value.toLocaleString();
    } catch (err) { el.textContent = "1,024+"; }
}

function setupAvatarDownload() {
    document.getElementById('avatar-download-trigger').addEventListener('click', async () => {
        const img = document.getElementById('u-avatar');
        if (!img.src || img.src.includes(window.location.hostname)) return;
        try {
            const response = await fetch(Eyas.proxy + encodeURIComponent(img.src));
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `EYAS_EXTRACT_${Eyas.state.data?.user?.uniqueId || 'IMG'}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) { console.error("DL_ERR", err); }
    });
}

const nF = (n) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n || 0);

const tF = (ts) => {
    if (!ts) return '0x00000000';
    const date = new Date(ts * 1000);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
};

window.reveal = (el) => {
    if (el.classList.contains('revealed') || !Eyas.state.data) return;
    const span = el.querySelector('span');
    span.textContent = span.id === 'd-userid' ? Eyas.state.data.user.id : Eyas.state.data.user.secUid;
    el.classList.add('revealed');
};

function render(payload) {
    const { user, stats } = payload;
    Eyas.state.data = payload;
    
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    
    document.getElementById('u-avatar').src = user.avatarLarger;
    document.getElementById('u-nickname').textContent = (user.nickname || user.uniqueId).toUpperCase();
    document.getElementById('u-handle').textContent = `@${user.uniqueId}`;
    user.verified ? document.getElementById('v-icon').classList.remove('hidden') : document.getElementById('v-icon').classList.add('hidden');
    document.getElementById('u-bio').textContent = user.signature || "NO_DATA_STRING";
    document.getElementById('u-link').href = `https://www.tiktok.com/@${user.uniqueId}`;

    document.getElementById('s-following').textContent = nF(stats.followingCount);
    document.getElementById('s-followers').textContent = nF(stats.followerCount);
    document.getElementById('s-hearts').textContent = nF(stats.heartCount);
    document.getElementById('s-videos').textContent = nF(stats.videoCount);
    document.getElementById('s-friends').textContent = nF(stats.friendCount);
    
    const rate = ((stats.heartCount / (stats.videoCount || 1)) / (stats.followerCount || 1)) * 100;
    document.getElementById('u-engagement').textContent = isFinite(rate) ? rate.toFixed(2) + "%" : "0.00%";
    
    const country = Eyas.state.countries.get(user.region?.toUpperCase());
    const emoji = country ? country.emoji : "🌐";
    const countryName = country ? country.name.toUpperCase() : (user.region || "UNKNOWN");
    document.getElementById('u-region-val').textContent = `REGION: ${emoji} ${countryName}`;
    
    document.getElementById('u-lang-val').textContent = (Eyas.state.languages.get(user.language?.toLowerCase()) || user.language || 'EN').toUpperCase();
    document.getElementById('active-country-label').textContent = `MAPPED_LOC: ${countryName}`;

    document.getElementById('d-verified').textContent = user.verified ? "Verified" : "False";
    document.getElementById('d-private').textContent = user.privateAccount ? "False" : "Public";
    document.getElementById('d-created').textContent = tF(user.createTime);
    
    // Reset masked states
    const uSpan = document.getElementById('d-userid');
    const sSpan = document.getElementById('d-secuid');
    uSpan.textContent = '••••••••••••';
    sSpan.textContent = '••••••••••••••••';
    uSpan.parentElement.classList.remove('revealed');
    sSpan.parentElement.classList.remove('revealed');

    zoomToCountry(user.region);
}

function zoomToCountry(code) {
    if (!Eyas.worldMap || !code) return;
    const target = Eyas.worldMap.getElementById(code.toUpperCase());
    document.querySelectorAll('.country-active').forEach(p => p.classList.remove('country-active'));
    if (target) {
        target.classList.add('country-active');
        const bbox = target.getBBox();
        const pad = 60;
        Eyas.worldMap.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    }
}

document.getElementById('search-btn').addEventListener('click', async () => {
    const u = document.getElementById('username-input').value.trim().replace('@', '');
    if (!u) return;
    
    const btn = document.getElementById('search-btn');
    btn.textContent = "WAIT...";
    btn.disabled = true;
    
    document.getElementById('app-content').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
    
    try {
        const res = await fetch(Eyas.proxy + encodeURIComponent(`https://www.tiktok.com/@${u}`));
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const jsonEl = doc.querySelector('script[id="__UNIVERSAL_DATA_FOR_REHYDRATION__"]');
        
        if (!jsonEl) throw new Error("SCRAPE_FAILURE");
        
        const json = JSON.parse(jsonEl.textContent);
        const data = json?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
        
        if (data) render(data);
        else throw new Error("USER_NOT_FOUND");
    } catch (e) {
        alert(`CRITICAL_ERROR: ${e.message}`);
        document.getElementById('loading-state').classList.add('hidden');
    } finally {
        btn.textContent = "Scrape";
        btn.disabled = false;
    }
});

document.getElementById('clear-btn').addEventListener('click', () => location.reload());
document.getElementById('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

window.copyText = (id) => {
    if (!Eyas.state.data) return;
    const text = id === 'd-userid' ? Eyas.state.data.user.id : Eyas.state.data.user.secUid;
    navigator.clipboard.writeText(text);
};

window.onload = init;
