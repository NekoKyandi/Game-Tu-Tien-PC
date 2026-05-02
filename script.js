// ----- LƯU TRỮ GAME (SỬ DỤNG FILE HỆ THỐNG THAY VÌ LOCALSTORAGE) -----
let fs, path, ipcRenderer, saveFilePath;

try {
    // Kiểm tra xem có đang chạy trong Electron không
    fs = require('fs');
    path = require('path');
    ipcRenderer = require('electron').ipcRenderer;

    // Lấy đường dẫn từ main.js
    const userDataPath = ipcRenderer.sendSync('get-path-user-data');
    saveFilePath = path.join(userDataPath, 'savegame.json');
} catch (e) {
    console.warn("Môi trường trình duyệt: Tắt tính năng lưu file hệ thống.");
}

// ----- CƠ SỞ DỮ LIỆU GAME -----
const dsCanhGioi = [
    { name: "Phàm Nhân", maxLevel: 1, rate: 100 }, { name: "Luyện Khí Kỳ", maxLevel: 9, rate: 80 },
    { name: "Trúc Cơ Kỳ", maxLevel: 9, rate: 50 }, { name: "Kim Đan Kỳ", maxLevel: 9, rate: 30 },
    { name: "Nguyên Anh Kỳ", maxLevel: 9, rate: 10 }, { name: "Hóa Thần Kỳ", maxLevel: 9, rate: 5 }
];

const trangBiType = ["Phàm", "Linh", "Pháp", "Tiên"];

// Scale quái vật lớn để đánh được nhiều lượt
const dsBanDo = [
    { id: 0, name: "Ngoại Ô Thôn Làng", minRealm: 0, mobName: ["Lợn Rừng", "Sói Xám"], eAtk: 15, eDef: 2, eHp: 150, expMin: 15, expMax: 25, ltMin: 2, ltMax: 5, dropRate: 0.3 },
    { id: 1, name: "Yêu Thú Sâm Lâm", minRealm: 1, mobName: ["Huyết Mãng", "Yêu Hồ"], eAtk: 100, eDef: 30, eHp: 2000, expMin: 100, expMax: 150, ltMin: 15, ltMax: 30, dropRate: 0.4 },
    { id: 2, name: "Vạn Cốt Cốc", minRealm: 2, mobName: ["Khung Cốt Lính", "Oán Hồn"], eAtk: 800, eDef: 250, eHp: 25000, expMin: 800, expMax: 1200, ltMin: 150, ltMax: 300, dropRate: 0.5 },
    { id: 3, name: "Huyết Hải Bí Cảnh", minRealm: 3, mobName: ["Huyết Ma", "Giao Long"], eAtk: 6000, eDef: 2000, eHp: 250000, expMin: 5000, expMax: 10000, ltMin: 1000, ltMax: 2500, dropRate: 0.6 },
    { id: 4, name: "Hư Không Liệt Thổ", minRealm: 4, mobName: ["Hư Không Cự Thú", "Ma Vương"], eAtk: 50000, eDef: 15000, eHp: 1500000, expMin: 50000, expMax: 120000, ltMin: 15000, ltMax: 30000, dropRate: 0.7 }
];

const dbCongPhap = {
    "Cửu Hà Kiếm Quyết": { mult: 3, mpCost: 30 },
    "Thiên Lôi Dẫn": { mult: 4, mpCost: 50 },
    "Phá Thiên Nhất Kích": { mult: 6, mpCost: 100 }
};

const itemPrices = { "Hồi Huyết Đan": 20, "Phá Cảnh Đan": 100, "Thảo Dược": 5, "Khoáng Thạch": 8, "Tài Liệu Yêu Thú": 15, "Thiên Đạo Kết Tinh": 1000 };

let defaultPlayer = {
    canhGioiIndex: 0, tieuCanhGioi: 1,
    tuVi: 0, maxTuVi: 100,
    khiHuyet: 100, maxKhiHuyet: 100, linhLuc: 50, maxLinhLuc: 50,
    tanCongCoBan: 10, phongThuCoBan: 5, linhThach: 100,
    tongMon: "", buffDotPha: 0, buffTuKhi: 0, buaChu: 0,
    veBiCanh: 3, luyenTheLevel: 0, currentMap: 0, currentQuest: null,
    congPhapHocDuoc: [], trangBiCongPhap: "",
    inventory: { "Thảo Dược": 0, "Khoáng Thạch": 0, "Tài Liệu Yêu Thú": 0, "Túi Trữ Vật": 0 },
    trangBi: {
        vuKhi: { name: "Kiếm Rỉ", level: 0, base: 5, tier: 0 },
        phapY: { name: "Vải Thô", level: 0, base: 2, tier: 0 },
        phapBao: { name: "Bùa Hộ Mệnh", level: 0, base: 20, tier: 0 }
    }
};

let player = JSON.parse(JSON.stringify(defaultPlayer));
let autoInterval = null; let currentAutoMode = null; let passiveCultivationInterval = null;
let currentLogTab = 'all';

// TRẠNG THÁI CHIẾN ĐẤU (Không lưu vào save)
let activeEnemy = null; 

window.onload = function() {
    loadGame();
    if(!player.currentQuest) generateQuest();
    updateUI();
    addLog("Hệ thống khởi động. Nhục thân tuy phàm, Đạo tâm bất diệt!", "system");
    setInterval(() => { saveGame(false); player.veBiCanh++; updateUI(); }, 30000); 
    passiveCultivationInterval = setInterval(passiveTuLuyen, 3000); 
};

// ----- CÁC HÀM TÍNH TOÁN CHỈ SỐ -----
function getTongAtk() {
    let atk = player.tanCongCoBan + player.trangBi.vuKhi.base + (player.trangBi.vuKhi.level * (player.canhGioiIndex+1) * 5);
    if(player.tongMon === "Kiếm Tông") atk *= 1.2; 
    return Math.floor(atk);
}
function getTongDef() {
    let def = player.phongThuCoBan + player.trangBi.phapY.base + (player.trangBi.phapY.level * (player.canhGioiIndex+1) * 3);
    def += (player.luyenTheLevel * 20); 
    return Math.floor(def);
}
function getTongMaxHP() {
    let hp = player.maxKhiHuyet + player.trangBi.phapBao.base + (player.trangBi.phapBao.level * (player.canhGioiIndex+1) * 20);
    hp += (player.luyenTheLevel * 200); 
    return Math.floor(hp);
}
function getChienLuc() {
    return (getTongAtk() * 2) + (getTongDef() * 3) + getTongMaxHP();
}

// ----- UI & RENDER -----
function updateBar(idBar, idText, current, max) {
    let percent = (current / max) * 100; if(percent > 100) percent = 100;
    document.getElementById(idBar).style.width = percent + "%";
    let textCur = current > 10000 ? (current/1000).toFixed(1) + 'k' : Math.floor(current);
    let textMax = max > 10000 ? (max/1000).toFixed(1) + 'k' : max;
    document.getElementById(idText).innerText = `${textCur} / ${textMax}`;
}

function renderMaps() {
    const mapSelect = document.getElementById('map-selection');
    mapSelect.innerHTML = "";
    dsBanDo.forEach(map => {
        if(player.canhGioiIndex >= map.minRealm) {
            let selected = (player.currentMap === map.id) ? "selected" : "";
            mapSelect.innerHTML += `<option value="${map.id}" ${selected}>🗺️ ${map.name} (Y/c: ${dsCanhGioi[map.minRealm].name})</option>`;
        }
    });
}

function renderSkills() {
    const select = document.getElementById('skill-selection');
    select.innerHTML = `<option value="">[Đánh Thường]</option>`;
    player.congPhapHocDuoc.forEach(sp => {
        let selected = (player.trangBiCongPhap === sp) ? "selected" : "";
        let info = dbCongPhap[sp];
        select.innerHTML += `<option value="${sp}" ${selected}>${sp} (Dmg x${info.mult}, tốn ${info.mpCost}MP)</option>`;
    });
}

function changeMap() { 
    player.currentMap = parseInt(document.getElementById('map-selection').value); 
    activeEnemy = null; // Đổi map thì reset quái đang đánh
    updateEnemyUI();
}
function equipSkill() { player.trangBiCongPhap = document.getElementById('skill-selection').value; }

function updateUI() {
    let major = dsCanhGioi[player.canhGioiIndex];
    let realmStr = major.name; if(major.maxLevel > 1) realmStr += ` - Tầng ${player.tieuCanhGioi}`;
    document.getElementById('canh-gioi').innerText = realmStr;
    
    let maxHP = getTongMaxHP(); if(player.khiHuyet > maxHP) player.khiHuyet = maxHP;

    updateBar('bar-exp', 'text-exp', player.tuVi, player.maxTuVi);
    updateBar('bar-hp', 'text-hp', player.khiHuyet, maxHP);
    updateBar('bar-mp', 'text-mp', player.linhLuc, player.maxLinhLuc);

    document.getElementById('chien-luc').innerText = getChienLuc().toLocaleString();
    document.getElementById('tan-cong').innerText = getTongAtk().toLocaleString();
    document.getElementById('phong-thu').innerText = getTongDef().toLocaleString();
    document.getElementById('linh-thach').innerText = player.linhThach.toLocaleString();
    document.getElementById('luyen-the-lv').innerText = player.luyenTheLevel;
    document.getElementById('so-ve-bicong').innerText = player.veBiCanh;

    let isMajorBreak = (player.tieuCanhGioi === major.maxLevel);
    document.getElementById('ty-le-dot-pha').innerText = (player.canhGioiIndex >= dsCanhGioi.length-1 && isMajorBreak) ? "MAX" : `${isMajorBreak ? major.rate : 90}% (+${player.buffDotPha}%)`;
    document.getElementById('so-bua-chu').innerText = player.buaChu;
    document.getElementById('buff-tu-khi').innerText = player.buffTuKhi + " lượt";
    document.getElementById('tong-mon').innerText = player.tongMon || "Tán Tu";

    let sectDiv = document.getElementById('sect-selection');
    if (sectDiv) sectDiv.style.display = (player.canhGioiIndex >= 1 && player.tongMon === "") ? "grid" : "none";

    document.getElementById('btn-dot-pha').disabled = !(player.tuVi >= player.maxTuVi);
    let modalLinhThach = document.getElementById('modal-linh-thach');
    if(modalLinhThach) modalLinhThach.innerText = player.linhThach.toLocaleString();

    renderQuest(); renderMaps(); renderInventory(); renderEquipment(); renderSkills();
}

function updateEnemyUI() {
    let panel = document.getElementById('enemy-panel');
    if(!activeEnemy) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        document.getElementById('enemy-name').innerText = activeEnemy.name + (activeEnemy.isBoss ? " [BOSS]" : "");
        document.getElementById('enemy-name').style.color = activeEnemy.isBoss ? "#d946ef" : (activeEnemy.isPK ? "#fb923c" : "#fca5a5");
        document.getElementById('enemy-stats').innerText = `ATK: ${activeEnemy.atk.toLocaleString()} | DEF: ${activeEnemy.def.toLocaleString()}`;
        updateBar('bar-enemy-hp', 'text-enemy-hp', activeEnemy.hp, activeEnemy.maxHp);
    }
}

function renderQuest() {
    if(!player.currentQuest) return;
    let q = player.currentQuest; let progress = player.inventory[q.item] || 0;
    let color = progress >= q.req ? "#4ade80" : "#e0e0e0";
    document.getElementById('quest-desc').innerHTML = `Thu thập: <b>${q.item}</b> <span style="color:${color}">(${progress}/${q.req})</span>`;
    document.getElementById('quest-reward').innerText = `Thưởng: ${q.reward.toLocaleString()} 💎`;
}

function renderEquipment() {
    const list = document.getElementById('trang-bi-list'); list.innerHTML = "";
    const equips = [ { key: 'vuKhi', stat: 'ATK' }, { key: 'phapY', stat: 'DEF' }, { key: 'phapBao', stat: 'HP' } ];

    equips.forEach(eq => {
        let item = player.trangBi[eq.key];
        let cost = (item.level + 1) * 100 * (player.canhGioiIndex + 1); 
        list.innerHTML += `
            <div class="box-item flex-between">
                <div>
                    <div class="tier-${item.tier}" style="font-weight:bold;">[${trangBiType[item.tier]}] ${item.name} +${item.level}</div>
                </div>
                <button class="btn-upgrade" onclick="upgradeEquip('${eq.key}', ${cost})">Tế Luyện (${cost}💎)</button>
            </div>
        `;
    });
}

function renderInventory() {
    const invList = document.getElementById('inventory-list'); invList.innerHTML = ""; 
    for (let item in player.inventory) {
        if (player.inventory[item] > 0) {
            let btnHtml = "";
            if (itemPrices[item]) btnHtml += `<button class="btn-upgrade" style="margin-left:5px;" onclick="sellItem('${item}')">Bán</button>`;
            if (item === "Hồi Huyết Đan" || item === "Phá Cảnh Đan" || item === "Túi Trữ Vật" || item.startsWith("Bí Kíp")) {
                btnHtml += `<button class="btn-upgrade" style="margin-left:5px; background:#1e3a8a;" onclick="useItem('${item}')">Dùng</button>`;
            }
            invList.innerHTML += `<div class="box-item flex-between"><span>${item} <b style="color:#fde047">x${player.inventory[item]}</b></span><div>${btnHtml}</div></div>`;
        }
    }
}

// ----- LOGIC UI BỔ SUNG -----
function switchLogTab(tab) {
    currentLogTab = tab;
    document.getElementById('tab-all').classList.remove('active'); document.getElementById('tab-sys').classList.remove('active'); document.getElementById('tab-cmb').classList.remove('active');
    if(tab==='all') document.getElementById('tab-all').classList.add('active');
    else if(tab==='system') document.getElementById('tab-sys').classList.add('active');
    else if(tab==='combat') document.getElementById('tab-cmb').classList.add('active');
    
    const logs = document.querySelectorAll('.log-entry');
    logs.forEach(log => {
        if (tab === 'all') log.style.display = 'block';
        else if (tab === 'system') log.style.display = log.classList.contains('log-sys') ? 'block' : 'none';
        else if (tab === 'combat') log.style.display = log.classList.contains('log-cmb') ? 'block' : 'none';
    });
}

function addLog(message, tabType = "system", colorClass = "log-system") {
    const logBox = document.getElementById('log-box');
    let displayType = (currentLogTab === 'all' || currentLogTab === tabType) ? 'block' : 'none';
    let tabClass = tabType === 'system' ? 'log-sys' : 'log-cmb';
    logBox.innerHTML += `<div class="log-entry ${tabClass} ${colorClass}" style="display:${displayType}">[${new Date().toLocaleTimeString()}] ${message}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

function openShop() { document.getElementById('shop-modal').style.display = 'flex'; updateUI(); }
function closeShop() { document.getElementById('shop-modal').style.display = 'none'; }
function closeShopOutside(event) { if (event.target.id === 'shop-modal') closeShop(); }

// ----- LOGIC CƠ BẢN (SHOP, NHIỆM VỤ, NÂNG CẤP) -----
function generateQuest() {
    const reqs = [ { item: "Thảo Dược", min: 10, max: 30, rwMult: 8 }, { item: "Khoáng Thạch", min: 5, max: 20, rwMult: 12 }, { item: "Tài Liệu Yêu Thú", min: 5, max: 15, rwMult: 20 } ];
    let type = reqs[Math.floor(Math.random() * reqs.length)];
    let amount = Math.floor(Math.random() * (type.max - type.min + 1)) + type.min;
    let baseReward = amount * type.rwMult * (player.canhGioiIndex + 1); 
    player.currentQuest = { item: type.item, req: amount, reward: baseReward }; updateUI();
}
function refreshQuest() { if(player.linhThach >= 50) { player.linhThach -= 50; generateQuest(); addLog("Hối lộ đổi nhiệm vụ.", "system"); } }
function submitQuest() {
    let q = player.currentQuest;
    if(player.inventory[q.item] >= q.req) {
        player.inventory[q.item] -= q.req; player.linhThach += q.reward;
        addLog(`Hoàn thành nhiệm vụ! Nhận ${q.reward} Linh Thạch.`, "system", "log-gain"); generateQuest();
    } else addLog(`Chưa đủ ${q.req} ${q.item}!`, "system", "log-combat");
}

function craftItem(itemName) {
    if (itemName === 'Hồi Huyết Đan' && (player.inventory["Thảo Dược"]||0) >= 2) {
        player.inventory["Thảo Dược"] -= 2; player.inventory["Hồi Huyết Đan"] = (player.inventory["Hồi Huyết Đan"]||0) + 1;
        addLog("Luyện thành công Hồi Huyết Đan.", "system");
    } else if (itemName === 'Phá Cảnh Đan' && (player.inventory["Thảo Dược"]||0) >= 5 && (player.inventory["Khoáng Thạch"]||0) >= 2) {
        player.inventory["Thảo Dược"] -= 5; player.inventory["Khoáng Thạch"] -= 2; player.inventory["Phá Cảnh Đan"] = (player.inventory["Phá Cảnh Đan"]||0) + 1;
        addLog("Luyện thành công Phá Cảnh Đan.", "system");
    } else addLog("Thiếu nguyên liệu luyện đan!", "system", "log-combat"); updateUI();
}

function sellItem(itemName) {
    if (player.inventory[itemName] > 0 && itemPrices[itemName]) {
        let qty = player.inventory[itemName]; let earned = qty * itemPrices[itemName];
        player.inventory[itemName] = 0; player.linhThach += earned;
        addLog(`Bán ${qty} ${itemName} thu được ${earned} 💎.`, "system"); updateUI();
    }
}

function useItem(itemName) {
    if (player.inventory[itemName] > 0) {
        player.inventory[itemName]--;
        if (itemName === "Hồi Huyết Đan") {
            let heal = Math.floor(getTongMaxHP() * 0.4);
            player.khiHuyet = Math.min(getTongMaxHP(), player.khiHuyet + heal); // Không vượt quá Max HP
            addLog(`Nuốt Hồi Huyết Đan, khôi phục ${heal} HP.`, "system", "log-gain");
        } 
        else if (itemName === "Phá Cảnh Đan") {
            // Tính toán lại tỷ lệ hiện tại ngay lúc này
            let major = dsCanhGioi[player.canhGioiIndex];
            let isMajorBreak = (player.tieuCanhGioi === major.maxLevel);
            let tiLeHienTai = (isMajorBreak ? major.rate : 90) + player.buffDotPha;

            if (tiLeHienTai < 100) {
                player.buffDotPha += 1;
                addLog("Tỷ lệ đột phá tăng thêm 1%.", "system", "log-gain");
            } else {
                addLog("Tỷ lệ đột phá đã đạt cực hạn (100%), không cần dùng thêm!", "system", "log-warning");
                // Hoàn trả lại đan dược nếu đã 100%
                player.inventory[itemName]++; 
            }
            updateUI(); // Gọi hàm cập nhật chung
            renderInventory();
            saveGame();
        }
        if (itemName === "Túi Trữ Vật") {
            let lt = Math.floor(Math.random() * 500) + 100 * (player.canhGioiIndex+1); player.linhThach += lt;
            let ore = Math.floor(Math.random() * 10) + 5;
            player.inventory["Khoáng Thạch"] = (player.inventory["Khoáng Thạch"]||0) + ore;
            addLog(`Mở Túi Trữ Vật cướp được, nhận ${lt} 💎 và ${ore} Khoáng Thạch!`, "system", "log-kyngo");
        } else if (itemName.startsWith("Bí Kíp - ")) {
            let skillName = itemName.replace("Bí Kíp - ", "");
            if(!player.congPhapHocDuoc.includes(skillName)) {
                player.congPhapHocDuoc.push(skillName); addLog(`Tuyệt học! Lĩnh ngộ [${skillName}].`, "system", "log-kyngo");
            } else addLog("Đã học công pháp này rồi.", "system");
        }
        updateUI();
    }
}

function upgradeEquip(slot, cost) {
    if (player.linhThach >= cost) {
        player.linhThach -= cost; player.trangBi[slot].level++;
        addLog(`Tế luyện thành công ${player.trangBi[slot].name} lên +${player.trangBi[slot].level}.`, "system", "log-gain");
        if (player.trangBi[slot].level % 5 === 0 && player.trangBi[slot].tier < 3) {
            player.trangBi[slot].tier++;
            addLog(`Kỳ diệu! [${player.trangBi[slot].name}] đột phá thành ${trangBiType[player.trangBi[slot].tier]} Khí!`, "system", "log-kyngo");
        }
        updateUI();
    } else addLog("Linh thạch khô kiệt!", "system", "log-combat"); 
}

function upgradeLuyenThe() {
    let costLT = (player.luyenTheLevel + 1) * 200; let costDuoc = (player.luyenTheLevel + 1) * 5;
    if(player.linhThach >= costLT && (player.inventory["Thảo Dược"]||0) >= costDuoc) {
        player.linhThach -= costLT; player.inventory["Thảo Dược"] -= costDuoc; player.luyenTheLevel++;
        addLog(`Nhục thân rèn luyện đạt Cấp ${player.luyenTheLevel}. HP và DEF tăng vọt!`, "system", "log-gain"); updateUI();
    } else addLog(`Cần ${costLT}💎 và ${costDuoc} Thảo Dược!`, "system", "log-combat");
}

function joinSect(sectName) { player.tongMon = sectName; addLog(`Bạn bái nhập ${sectName}.`, "system"); updateUI(); }

function buyShop(itemName, cost) {
    if(player.linhThach >= cost) {
        player.linhThach -= cost;
        if(itemName === "Thế Mạng Phù") player.buaChu++; if(itemName === "Tụ Khí Trận") player.buffTuKhi += 100; if(itemName === "Vé Bí Cảnh") player.veBiCanh++;
        updateUI(); addLog(`Mua thành công ${itemName}.`, "system", "log-system");
    } else addLog("Không đủ Linh Thạch!", "system", "log-combat");
}

// ----- CƠ CHẾ CHIẾN ĐẤU THỜI GIAN THỰC MỚI -----
function passiveTuLuyen() {
    if(player.tuVi >= player.maxTuVi) return;
    if (player.tongMon === "Dược Cốc") { player.khiHuyet += 10; player.linhLuc += 5; }

    let base = Math.floor(Math.random() * 10) + 5;
    let exp = base * (player.canhGioiIndex + 1) * player.tieuCanhGioi; 
    if (player.buffTuKhi > 0) { exp *= 2; player.buffTuKhi--; }

    player.tuVi += exp; if (player.tuVi > player.maxTuVi) player.tuVi = player.maxTuVi;
    if (Math.random() < 0.2) addLog(`[Thụ Động] Hấp thu linh khí, Tu Vi +${exp}.`, "system", "log-gain");
    updateUI();
}

function diBiCanh() {
    if(player.veBiCanh <= 0) { addLog("Không còn vé vào Bí Cảnh!", "system", "log-combat"); return; }
    if(player.khiHuyet <= 0) { addLog("Trọng thương, không thể vào Bí Cảnh!", "system", "log-combat"); return; }
    
    player.veBiCanh--;
    let map = dsBanDo.find(m => m.id === player.currentMap);
    activeEnemy = {
        name: "Yêu Vương " + map.mobName[0], isBoss: true, isPK: false, mapInfo: map,
        hp: map.eHp * 5, maxHp: map.eHp * 5, atk: map.eAtk * 2, def: map.eDef * 1.5
    };
    addLog(`Cánh cửa Bí Cảnh mở ra... Phát hiện [${activeEnemy.name}]!`, "combat", "log-pk");
    updateEnemyUI();
}

function lichLuyen() {
    if (player.khiHuyet <= 0) { 
        addLog("Huyết khí khô kiệt, mau liệu thương!", "combat", "log-combat"); 
        return; 
    }

    // Nếu không có quái, thì Spawn
    if (!activeEnemy) {
        if(Math.random() < 0.05) { 
            player.tuVi+= (player.maxTuVi * 0.2); addLog(`✨[KỲ NGỘ] Rơi xuống vách núi phát hiện hồ Linh Tuyền! Nhận Tu Vi.`, "system", "log-kyngo"); updateUI(); return; 
        }
        let map = dsBanDo.find(m => m.id === player.currentMap);
        if(Math.random() < 0.05 && player.canhGioiIndex > 0) {
            activeEnemy = { name: "Tán Tu Ác Bá", isBoss: false, isPK: true, mapInfo: map, hp: map.eHp*1.5, maxHp: map.eHp*1.5, atk: map.eAtk*1.2, def: map.eDef*2 };
            addLog(`Phát hiện Tán Tu ngáng đường! Tiến vào chiến đấu!`, "combat", "log-pk");
        } else {
            let tenQuai = map.mobName[Math.floor(Math.random() * map.mobName.length)];
            activeEnemy = { name: tenQuai, isBoss: false, isPK: false, mapInfo: map, hp: map.eHp, maxHp: map.eHp, atk: map.eAtk, def: map.eDef };
            addLog(`Chạm trán [${tenQuai}]!`, "combat", "log-system");
        }
        updateEnemyUI();
    }

    // Tiến hành 1 Lượt đánh
    thucHienGiaoTranh();
}

function thucHienGiaoTranh() {
    if(!activeEnemy) return;

    let pAtk = getTongAtk(); let pDef = getTongDef();
    
    // Bạn đánh Quái
    let dungSkill = false; let pMult = 1;
    if(player.trangBiCongPhap !== "" && Math.random() < 0.25) { 
        let sInfo = dbCongPhap[player.trangBiCongPhap];
        if(player.linhLuc >= sInfo.mpCost) {
            player.linhLuc -= sInfo.mpCost; pMult = sInfo.mult; dungSkill = true;
            addLog(`⚡Xuất chiêu [${player.trangBiCongPhap}] gây sát thương bạo kích!`, "combat", "log-skill");
        }
    }

    let dmgToQuai = (pAtk * pMult) - activeEnemy.def; if(dmgToQuai < 1) dmgToQuai = 1;
    activeEnemy.hp -= dmgToQuai;

    // Ma tông hút máu
    if(player.tongMon === "Ma Tông") { player.khiHuyet += Math.floor(dmgToQuai * 0.1); }

    // Quái đánh lại bạn
    if (activeEnemy.hp > 0) {
        let dmgToPlayer = activeEnemy.atk - pDef; if(dmgToPlayer < 1) dmgToPlayer = 1;
        player.khiHuyet -= dmgToPlayer;

        // Xử lý nếu bạn chết
        if (player.khiHuyet <= 0) {
            if (player.buaChu > 0) {
                player.buaChu--; player.khiHuyet = 1; addLog(`[Thế Mạng Phù] kích hoạt, cứu mạng bạn 1 lần!`, "combat", "log-kyngo");
            } else {
                player.khiHuyet = 0; activeEnemy = null; // Bỏ chạy
                addLog(`Bị đánh trọng thương, tháo chạy giữ mạng!`, "combat", "log-combat");
                if (currentAutoMode === 'lichluyen') toggleAuto(); // Tắt auto nếu chết
            }
        }
    } else {
        // Quái CHẾT -> Nhận thưởng
        let map = activeEnemy.mapInfo;
        let expGot = activeEnemy.isBoss ? map.expMax*5 : (Math.floor(Math.random() * (map.expMax - map.expMin + 1)) + map.expMin);
        player.tuVi += expGot; 
        
        addLog(`Đã tiêu diệt [${activeEnemy.name}]. Nhận +${expGot} Tu Vi.`, "combat", "log-detail");
        
        // Xử lý Rớt Đồ
        if(activeEnemy.isPK) {
            player.inventory["Túi Trữ Vật"] = (player.inventory["Túi Trữ Vật"]||0) + 1; addLog(`Cướp được 1 [Túi Trữ Vật]!`, "system", "log-pk");
        } else if (activeEnemy.isBoss) {
            player.linhThach += map.ltMax * 5;
            if(Math.random() < 0.5) player.inventory["Thiên Đạo Kết Tinh"] = (player.inventory["Thiên Đạo Kết Tinh"]||0) + 1;
            if(Math.random() < 0.4) {
                let keys = Object.keys(dbCongPhap); let rngSkill = keys[Math.floor(Math.random() * keys.length)];
                player.inventory[`Bí Kíp - ${rngSkill}`] = (player.inventory[`Bí Kíp - ${rngSkill}`]||0) + 1;
                addLog(`Bí Cảnh rớt tuyệt học: [Bí Kíp - ${rngSkill}]!`, "system", "log-kyngo");
            }
        } else if (Math.random() < map.dropRate) { 
            let roll = Math.random();
            if(roll < 0.4) player.inventory["Thảo Dược"] = (player.inventory["Thảo Dược"]||0) + 1; 
            else if(roll < 0.7) player.inventory["Khoáng Thạch"] = (player.inventory["Khoáng Thạch"]||0) + 1; 
            else player.inventory["Tài Liệu Yêu Thú"] = (player.inventory["Tài Liệu Yêu Thú"]||0) + 1; 
            if(currentLogTab !== 'combat') addLog(`Thu thập được vật phẩm.`, "system", "log-system");
        }
        
        activeEnemy = null; // Xóa quái để lượt sau spawn con mới
    }
    
    updateUI(); updateEnemyUI();
}

function nghiNgoi() {
    let maxHP = getTongMaxHP();
    if (player.khiHuyet === maxHP && player.linhLuc === player.maxLinhLuc) return;
    player.khiHuyet += Math.floor(maxHP * 0.4); player.linhLuc += Math.floor(player.maxLinhLuc * 0.5); 
    if(player.khiHuyet > maxHP) player.khiHuyet = maxHP; if(player.linhLuc > player.maxLinhLuc) player.linhLuc = player.maxLinhLuc;
    addLog("Liệu thương, khôi phục HP và MP.", "combat", "log-system"); updateUI();
}

function dotPha() {
    let major = dsCanhGioi[player.canhGioiIndex];
    let isMajorBreak = (player.tieuCanhGioi === major.maxLevel);
    let tl = isMajorBreak ? major.rate : 90; tl += player.buffDotPha; player.buffDotPha = 0; 
    
    if (Math.random() * 100 <= tl) {
        if(isMajorBreak) {
            let nextMajor = dsCanhGioi[player.canhGioiIndex + 1]; if(!nextMajor) return;
            player.canhGioiIndex++; player.tieuCanhGioi = 1; player.tuVi = 0; player.maxTuVi = Math.floor(player.maxTuVi * 5); 
            player.tanCongCoBan *= 3; player.phongThuCoBan *= 3; player.maxKhiHuyet *= 3; player.maxLinhLuc *= 2;
            player.khiHuyet = getTongMaxHP(); player.linhLuc = player.maxLinhLuc;
            addLog(`⚡Độ kiếp thăng cấp 【${nextMajor.name}】!`, "system", "log-kyngo");
        } else {
            player.tieuCanhGioi++; player.tuVi = 0; player.maxTuVi = Math.floor(player.maxTuVi * 1.5);
            player.tanCongCoBan = Math.floor(player.tanCongCoBan * 1.15); player.phongThuCoBan = Math.floor(player.phongThuCoBan * 1.15);
            player.maxKhiHuyet = Math.floor(player.maxKhiHuyet * 1.15); player.maxLinhLuc = Math.floor(player.maxLinhLuc * 1.15);
            player.khiHuyet = getTongMaxHP(); player.linhLuc = player.maxLinhLuc;
            addLog(`Đột phá Tầng ${player.tieuCanhGioi}!`, "system", "log-system");
        }
    } else {
        if (player.buaChu > 0 && isMajorBreak) { player.buaChu--; addLog(`Đột phá thất bại! [Thế Mạng Phù] bảo toàn.`, "system"); } 
        else {
            if(isMajorBreak) { player.tuVi = 0; player.khiHuyet = 1; addLog(`💥Độ kiếp THẤT BẠI!`, "system", "log-combat"); } 
            else { player.tuVi = Math.floor(player.maxTuVi * 0.5); addLog(`Khí huyết đảo nghịch, thất bại!`, "system", "log-combat"); }
        }
    }
    updateUI(); saveGame(false);
}

function toggleAuto() {
    let btnLichLuyen = document.getElementById('btn-auto-lich-luyen');
    if (currentAutoMode === 'lichluyen') {
        clearInterval(autoInterval); currentAutoMode = null;
        btnLichLuyen.innerText = "Treo Đánh Quái"; btnLichLuyen.classList.remove("btn-auto-combat");
        return;
    }
    currentAutoMode = 'lichluyen';
    btnLichLuyen.innerText = "Đang Treo: Đánh Quái"; btnLichLuyen.classList.add("btn-auto-combat");
    
    // Auto chém mỗi 0.5 giây (Tốc độ chiến đấu thật)
    autoInterval = setInterval(() => { 
        let maxHP = getTongMaxHP();
        if(player.khiHuyet < maxHP * 0.3 || player.linhLuc < player.maxLinhLuc * 0.2) { nghiNgoi(); } 
        else { lichLuyen(); } 
    }, 500); 
}

// ----- HỆ THỐNG LƯU / TẢI GAME (PHIÊN BẢN NSIS INSTALLER) -----

// --- KHAI BÁO BIẾN TOÀN CỤC CHO LƯU GAME ---

try {
    // Chỉ nạp các thư viện này nếu đang chạy trong Electron
    fs = require('fs');
    path = require('path');
    const { ipcRenderer } = require('electron');
    
    const userDataPath = ipcRenderer.sendSync('get-path-user-data');
    saveFilePath = path.join(userDataPath, 'savegame.json');
} catch (e) {
    console.error("Đang chạy trên trình duyệt web thường, tính năng lưu file sẽ bị tắt.");
}

// --- HÀM LƯU GAME AN TOÀN ---
function saveGame(isManual = false) {
    // 1. Vẫn luôn lưu vào localStorage như cũ (để dự phòng)
    localStorage.setItem('tutien_v4_scale', JSON.stringify(player));

    // 2. Nếu có môi trường Electron thì mới lưu vào file
    if (fs && saveFilePath) {
        try {
            fs.writeFileSync(saveFilePath, JSON.stringify(player, null, 4), 'utf-8');
        } catch (err) {
            console.error("Ghi file thất bại:", err);
        }
    }

    if (isManual && typeof addLog === "function") {
        addLog("Đã dùng bí thuật khắc sâu thần thức (Lưu Game thành công).", "log-system");
    }
}

function loadGame() {
    // Ưu tiên đọc từ file trước
    if (fs && fs.existsSync(saveFilePath)) {
        const saved = fs.readFileSync(saveFilePath, 'utf-8');
        player = { ...defaultPlayer, ...JSON.parse(saved) };
    } else {
        // Nếu không có file thì đọc từ localStorage (cách cũ của bạn)
        let saved = localStorage.getItem('tutien_v4_scale');
        if (saved) player = { ...defaultPlayer, ...JSON.parse(saved) };
    }
}
async function initVersion() {
    // Yêu cầu main.js gửi version về
    const version = await ipcRenderer.invoke('get-app-version');
    
    // Tự động điền vào thẻ div
    const versionElement = document.getElementById('version-display');
    if (versionElement) {
        versionElement.innerText = `Phiên bản: v${version}`;
    }
}

    initVersion();