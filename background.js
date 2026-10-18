// One badge per tab, merged from every frame's report:
//   green number - blockers cleared on this page
//   orange !     - something visible keeps RTX Video off (left to the site)
const tabs = new Map(); // tabId -> Map(frameId -> state)

function render(tabId) {
  const frames = tabs.get(tabId);
  const states = frames ? [...frames.values()].filter(Boolean) : [];
  const fixed = states.flatMap(s => s.fixed);
  const blockers = states.flatMap(s => [...s.visibleBlockers.map(d => 'blur ' + d), ...s.otherVideos.map(d => 'video ' + d)]);
  let text = '', color = '#1a7f37', title = 'RTX Video Unblock';
  if (!states.length) title += '\nNo video on this page.';
  else {
    if (fixed.length) { text = String(fixed.length); title += '\nCleared:\n  ' + fixed.join('\n  '); }
    if (blockers.length) {
      if (!fixed.length) { text = '!'; color = '#d97706'; }
      title += '\nStill in the way (visible, left alone):\n  ' + blockers.join('\n  ');
    }
    if (!fixed.length && !blockers.length) title += '\nNothing in the way.';
  }
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setTitle({ tabId, title }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.kind !== 'rtx-unblock' || !sender.tab) return;
  const tabId = sender.tab.id;
  if (!tabs.has(tabId)) tabs.set(tabId, new Map());
  tabs.get(tabId).set(sender.frameId, message.state);
  render(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) { tabs.delete(tabId); render(tabId); }
});
chrome.tabs.onRemoved.addListener(tabId => tabs.delete(tabId));
