notifiers = {}

function extractRestaurantName(url) {
    return url.match(/\/restaurant\/([^\/]+)/)[1]
}

async function getRestaurantTabs(restaurant) {
    return browser.tabs.query({ url: 'https://wolt.com/**/restaurant/' + restaurant })
}

async function setTabIconState(tab, state) {
    browser.pageAction.setIcon({ tabId: tab.id, path: state ? 'icon-red.png' : 'icon.png' })
    browser.pageAction.setTitle({ tabId: tab.id, title: state ? 'Disable notifier' : 'Notify when online' })
    browser.pageAction.show(tab.id)
}

async function setIconState(restaurant, state) {
    tabs = await getRestaurantTabs(restaurant)
    for (tab of tabs) {
        setTabIconState(tab, state)
    }
}

browser.pageAction.onClicked.addListener(async tab => {
    const restaurant = extractRestaurantName(tab.url)
    if (await browser.alarms.get(restaurant)) {
        browser.alarms.clear(restaurant)
        setIconState(restaurant, false)
        delete notifiers[restaurant]
    } else {
        notifiers[restaurant] = tab.url
        browser.alarms.create(restaurant, { delayInMinutes: .1 })
        setIconState(restaurant, true)
    }
})

browser.alarms.onAlarm.addListener(async alarmInfo => {
    console.log('alarm ' + alarmInfo.name)
    const { results: [{ name: [{ value: name }], online }] } = await (await fetch('https://restaurant-api.wolt.com/v3/venues/slug/' + alarmInfo.name)).json()
    if (online) {
        console.log('online')
        browser.notifications.create(alarmInfo.name, { type: 'basic', iconUrl: 'icon.png', title: 'Wolt Notifier', message: name + ' is open for orders' })
        setIconState(alarmInfo.name, false)
    } else {
        console.log('offline')
        browser.alarms.create(alarmInfo.name, { delayInMinutes: .1 })
    }
})

browser.tabs.onUpdated.addListener(async (_tabId, { url }, tab) => {
    if (!url) return
    const restaurant = extractRestaurantName(url)
    setTabIconState(tab, await browser.alarms.get(restaurant))
})

browser.notifications.onClicked.addListener(async notifId => {
    tabs = await getRestaurantTabs(notifId)
    if (tabs.length) {
        browser.tabs.reload(tabs[0].id)
        browser.tabs.update(tabs[0].id, { active: true })
        browser.windows.update(tabs[0].windowId, { focused: true })
    } else {
        tab = await browser.tabs.create({ url: notifiers[notifId] })
        browser.windows.update(tab.windowId, { focused: true })
    }
})
