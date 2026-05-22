// =========================================================================
// 1. СТРУКТУРИ ДАНИХ ТА ПЕРСИСТЕНТНІСТЬ (LOCALSTORAGE)
// =========================================================================

// Дефолтні клієнти (для демонстрації)
const defaultClients = [
    { phone: "+380991112233", name: "Олексій", totalSpentCash: 420 },
    { phone: "+380674445566", name: "Марія", totalSpentCash: 1650 },
    { phone: "+380637778899", name: "Дмитро", totalSpentCash: 5200 }
];

// Дефолтне меню кав'ярні
const defaultMenu = [
    { id: 1, name: "Еспресо класичний", price: 45, isSale: false, oldPrice: null },
    { id: 2, name: "Капучино XL", price: 75, isSale: false, oldPrice: null },
    { id: 3, name: "Лате Макіато", price: 80, isSale: false, oldPrice: null },
    { id: 4, name: "Раф Кава Лаванда", price: 90, isSale: true, oldPrice: 110 },
    { id: 5, name: "Круасан з мигдалем", price: 85, isSale: false, oldPrice: null },
    { id: 6, name: "Торт Естерхазі (шм.)", price: 95, isSale: true, oldPrice: 120 }
];

// Рівні лояльності клієнтського клубу
const clubTiers = [
    { name: "Поціновувач ☕", min: 0, discount: 0 },
    { name: "Бариста-Бро 👑", min: 500, discount: 5 },
    { name: "Кавовий Магнат 🚀", min: 1500, discount: 10 },
    { name: "Кавовий Абсолют 🌌", min: 4000, discount: 15 }
];

// Стан програми (State)
let clientsDatabase = loadFromStorage('aroma_cup_clients', defaultClients);
let coffeeMenu = loadFromStorage('aroma_cup_menu', defaultMenu);
let currentActiveClient = null; 
let shoppingCart = [];
let appliedPromoCode = null;

// Хелпери для роботи зі сховищем
function loadFromStorage(key, defaultValue) {
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
}

function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// =========================================================================
// 2. МОДУЛЬ УПРАВЛІННЯ КЛІЄНТАМИ (АВТОРІЗАЦІЯ)
// =========================================================================

function findClientByPhone() {
    const inputPhone = document.getElementById('phone-input').value.trim();
    
    if (inputPhone.length < 10) {
        alert("Будь ласка, введіть коректний номер телефону!");
        return;
    }

    const foundClient = clientsDatabase.find(c => c.phone === inputPhone);

    if (foundClient) {
        currentActiveClient = foundClient;
        alert(`Клієнта знайдено! Вітаємо назад, ${currentActiveClient.name}.`);
    } else {
        const registerNew = confirm("Цього номера немає в базі Aroma Club. Зареєструвати нового клієнта?");
        if (registerNew) {
            const newName = prompt("Введіть ім'я нового клієнта:") || "Новий гість";
            const newClient = { phone: inputPhone, name: newName, totalSpentCash: 0 };
            
            clientsDatabase.push(newClient);
            saveToStorage('aroma_cup_clients', clientsDatabase);
            
            currentActiveClient = newClient;
            alert(`Успішно зареєстровано клієнта: ${newName}!`);
        } else {
            return;
        }
    }

    toggleAuthUI(true);
    updateLoyaltyDisplay();
    refreshCartCalculations();
}

function logoutClient() {
    currentActiveClient = null;
    document.getElementById('phone-input').value = "+380";
    toggleAuthUI(false);
    updateLoyaltyDisplay();
    refreshCartCalculations();
}

function toggleAuthUI(isAuthorized) {
    const authForm = document.getElementById('auth-form');
    const welcomeMsg = document.getElementById('client-welcome-msg');
    const clientNameSpan = document.getElementById('client-name');

    if (isAuthorized && currentActiveClient) {
        authForm.style.display = 'none';
        welcomeMsg.style.display = 'flex';
        clientNameSpan.innerText = currentActiveClient.name;
    } else {
        authForm.style.display = 'flex';
        welcomeMsg.style.display = 'none';
    }
}

// =========================================================================
// 3. АЛГОРИТМИ СИСТЕМИ ЛОЯЛЬНОСТІ
// =========================================================================

function calculateCurrentTier(spentAmount) {
    let activeTier = clubTiers[0];
    let upcomingTier = null;

    for (let i = 0; i < clubTiers.length; i++) {
        if (spentAmount >= clubTiers[i].min) {
            activeTier = clubTiers[i];
            upcomingTier = clubTiers[i + 1] || null;
        }
    }
    return { activeTier, upcomingTier };
}

function updateLoyaltyDisplay() {
    const infoTextElement = document.getElementById('next-tier-info');
    const progressFill = document.getElementById('progress-fill');
    
    if (!currentActiveClient) {
        document.getElementById('tier-name').innerText = "Гість";
        document.getElementById('user-discount-val').innerText = "0%";
        infoTextElement.innerText = "Введіть телефон для активації дисконту";
        progressFill.style.width = '0%';
        return;
    }

    const status = calculateCurrentTier(currentActiveClient.totalSpentCash);
    
    document.getElementById('tier-name').innerText = status.activeTier.name;
    document.getElementById('user-discount-val').innerText = status.activeTier.discount + '%';

    if (status.upcomingTier) {
        const leftToSpend = status.upcomingTier.min - currentActiveClient.totalSpentCash;
        infoTextElement.innerText = `До статусу "${status.upcomingTier.name}" залишилось: ${leftToSpend} ₴`;
        
        const segmentRange = status.upcomingTier.min - status.activeTier.min;
        const currentSegmentProgress = currentActiveClient.totalSpentCash - status.activeTier.min;
        const percentage = (currentSegmentProgress / segmentRange) * 100;
        progressFill.style.width = percentage + '%';
    } else {
        infoTextElement.innerText = "Ти досяг вершини кавового дзену!";
        progressFill.style.width = '100%';
    }
}

// =========================================================================
// 4. УПРАВЛІННЯ МЕНЮ (АДМІН-ФУНКЦІЇ)
// =========================================================================

function addNewProduct(event) {
    event.preventDefault();

    const nameInput = document.getElementById('new-item-name');
    const priceInput = document.getElementById('new-item-price');
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);

    if (!name || isNaN(price)) return;

    const newId = coffeeMenu.length > 0 ? Math.max(...coffeeMenu.map(m => m.id)) + 1 : 1;
    const newProduct = { id: newId, name: name, price: price, isSale: false, oldPrice: null };

    coffeeMenu.push(newProduct);
    saveToStorage('aroma_cup_menu', coffeeMenu);
    displayMenu();

    nameInput.value = '';
    priceInput.value = '';
}

function deleteProductFromMenu(id) {
    const confirmDelete = confirm("Видалити цю позицію з асортименту?");
    if (!confirmDelete) return;

    coffeeMenu = coffeeMenu.filter(item => item.id !== id);
    saveToStorage('aroma_cup_menu', coffeeMenu);
    displayMenu();

    // Забираємо з кошика, якщо його видалили з меню
    shoppingCart = shoppingCart.filter(item => item.id !== id);
    renderCartList();
}

function displayMenu() {
    const catalogContainer = document.getElementById('catalog');
    
    if (coffeeMenu.length === 0) {
        catalogContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Меню порожнє. Додайте товари!</p>';
        return;
    }

    catalogContainer.innerHTML = coffeeMenu.map(item => `
        <div class="product-card">
            ${item.isSale ? `<span class="badge-sale">АКЦІЯ</span>` : ''}
            <h3 style="margin: 0 0 8px 0; font-size: 18px;">${item.name}</h3>
            <div class="price-block">
                ${item.isSale ? `<div class="old-price">${item.oldPrice} ₴</div>` : ''}
                <div class="current-price">${item.price} ₴</div>
            </div>
            <button type="button" onclick="addItemToCart(${item.id})">Замовити</button>
            <button type="button" class="btn-delete" onclick="deleteProductFromMenu(${item.id})">Видалити позицію</button>
        </div>
    `).join('');
}

// =========================================================================
// 5. ЛОГІКА КОШИКА ТА РОЗРАХУНКУ ЧЕКУ
// =========================================================================

function addItemToCart(id) {
    const menuItem = coffeeMenu.find(m => m.id === id);
    const existingInCart = shoppingCart.find(c => c.id === id);

    if (existingInCart) {
        existingInCart.quantity++;
    } else {
        shoppingCart.push({ ...menuItem, quantity: 1 });
    }
    renderCartList();
}

function renderCartList() {
    const cartContainer = document.getElementById('cart-items');
    
    if (shoppingCart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-cart-msg">Кошик порожній.</p>';
    } else {
        cartContainer.innerHTML = shoppingCart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <strong>${item.name}</strong> x${item.quantity}
                    ${item.isSale ? '<small>Спеціальна ціна</small>' : ''}
                </div>
                <span>${item.price * item.quantity} ₴</span>
            </div>
        `).join('');
    }
    refreshCartCalculations();
}

function refreshCartCalculations() {
    let subtotal = 0;
    let loyaltyDiscountSavings = 0;
    
    let loyaltyPercent = 0;
    if (currentActiveClient) {
        const tierStatus = calculateCurrentTier(currentActiveClient.totalSpentCash);
        loyaltyPercent = tierStatus.activeTier.discount;
    }

    shoppingCart.forEach(cartItem => {
        const cost = cartItem.price * cartItem.quantity;
        subtotal += cost;

        // Знижка лояльності діє лише на НЕакційні товари
        if (!cartItem.isSale) {
            loyaltyDiscountSavings += cost * (loyaltyPercent / 100);
        }
    });

    let totalWithLoyalty = subtotal - loyaltyDiscountSavings;
    let promoSavings = 0;

    if (appliedPromoCode === "COFFEE10") {
        promoSavings = totalWithLoyalty * 0.10;
        totalWithLoyalty -= promoSavings;
        document.getElementById('promo-row').style.display = 'flex';
    } else {
        document.getElementById('promo-row').style.display = 'none';
    }

    document.getElementById('discount-row').style.display = loyaltyDiscountSavings > 0 ? 'flex' : 'none';

    document.getElementById('subtotal').innerText = `${subtotal.toFixed(0)} ₴`;
    document.getElementById('discount-amount').innerText = `-${loyaltyDiscountSavings.toFixed(0)} ₴`;
    document.getElementById('promo-amount').innerText = `-${promoSavings.toFixed(0)} ₴`;
    document.getElementById('total-price').innerText = `${totalWithLoyalty.toFixed(0)} ₴`;
}

function applyPromo() {
    const enteredCode = document.getElementById('promo-input').value.trim().toUpperCase();
    if (enteredCode === "COFFEE10") {
        appliedPromoCode = "COFFEE10";
        alert("Промокод активовано!");
    } else {
        appliedPromoCode = null;
        alert("Невірний промокод ☕");
    }
    refreshCartCalculations();
}

function checkout() {
    if (shoppingCart.length === 0) return alert("Кошик порожній!");

    const finalAmount = parseFloat(document.getElementById('total-price').innerText);
    
    if (currentActiveClient) {
        currentActiveClient.totalSpentCash += finalAmount;
        saveToStorage('aroma_cup_clients', clientsDatabase);
        alert(`Замовлення оформлено! Сплачено: ${finalAmount} ₴. Суму накопичено на баланс.`);
    } else {
        alert(`Замовлення оформлено анонімно! Сплачено: ${finalAmount} ₴.`);
    }

    shoppingCart = [];
    appliedPromoCode = null;
    document.getElementById('promo-input').value = '';

    updateLoyaltyDisplay();
    renderCartList();
}

// Ініціалізація додатку при завантаженні
updateLoyaltyDisplay();
displayMenu();