/*!
  Project:  shorts-player-kit
  File:     js/modules/state.js
  Role:     Manages the core state (State, Ctrl) of the player.
*/

export const State = { scenes: [], idx: 0, playingLock: false };

export const Ctrl = {
  stopRequested: false,  // Stop押下直後の要求（ページ末で停止）
  stopped: false,        // Stopが確定し、次遷移や再生を抑止中
  stopReqAt: 0,          // Stop受付時刻（ACKレイテンシ計測用）
  lastCancelAt: 0,       // 直近 cancel() の時刻（Hard Stop整定用）
  activationDone: false, // 初回可聴ワンショット済み
  navToken: 0,           // ナビ世代トークン（Next/Prev/Goto/Restartで更新）
  videoMeta: {}          // scenes.json の videoMeta（advancePolicy 参照用）
};
