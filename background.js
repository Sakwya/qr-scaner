// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.cmd === "libLoadCompleted") {
    void chrome.tabs.sendMessage(sender.tab.id, "libLoadCompleted");
    return false;
  }
  if (msg.cmd === "fetchImageAsArrayBuffer") {
    const url = msg.url;
    // 使用 fetch 获取资源（扩展有 host_permissions 时可跨域）
    const req = fetch(url)
      .then((resp) => {
        if (!resp.ok)
          throw new Error("network response not ok: " + resp.status);
        return resp.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        sendResponse({ ok: true, data: arrayBufferToBase64(arrayBuffer) });
      })
      .catch((err) => {
        console.error("background fetch error", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // 告诉 Chrome 我们会异步调用 sendResponse
  }
});

function arrayBufferToBase64(arrayBuffer) {
  // 创建一个 Uint8Array 视图，读取 ArrayBuffer 中的数据
  const uint8Array = new Uint8Array(arrayBuffer);

  // 将 Uint8Array 转换为二进制字符串
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  // 使用 btoa() 将二进制字符串编码为 Base64
  const base64String = btoa(binaryString);

  return base64String;
}
