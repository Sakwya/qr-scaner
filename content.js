// content.js

const showToast = (message) => {
  console.log("showToast", message);
  // 创建一个 Toast 元素
  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.textContent = message;

  // 设置样式
  toast.style.position = "fixed";
  toast.style.top = "32px";
  toast.style.right = "16px";
  toast.style.backgroundColor = "#333a";
  toast.style.color = "#fff";
  toast.style.padding = "12px 18px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "18px";
  toast.style.zIndex = "9999";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.5s ease-in-out";

  // 添加到页面
  document.body.appendChild(toast);

  // 动画显示
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  // 动画隐藏
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);

  // 移除 Toast 元素
  setTimeout(() => {
    document.body.removeChild(toast);
  }, 3500);
};
window.showToast = showToast;

// 辅助：向 background 请求图片二进制
function fetchImageArrayBufferFromBackground(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { cmd: "fetchImageAsArrayBuffer", url },
      (response) => {
        if (!response) return reject(new Error("no response from background"));
        if (response.ok) {
          resolve(response.data); // ArrayBuffer
        } else {
          reject(new Error(response.error || "fetch failed"));
        }
      }
    );
  });
}
function base64ToArrayBuffer(base64) {
  // 使用 atob 解码 Base64 字符串
  const binaryString = atob(base64);

  // 创建一个与二进制字符串长度相同的 Uint8Array
  const length = binaryString.length;
  const arrayBuffer = new ArrayBuffer(length);
  const uint8Array = new Uint8Array(arrayBuffer);

  // 将二进制字符串的每个字符转换为字节，填充到 Uint8Array 中
  for (let i = 0; i < length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return arrayBuffer;
}

// 识别单张图片是否为二维码并解析（使用 jsQR）
// 注意：需要页面中已经加载 jsQR（例如通过 <script> 或扩展注入）
async function tryDecodeImage(imgElement) {
  const src = imgElement.src;
  // 如果 src 是 data: 或 局域同源，可以直接用；这里统一走 fetch 以避免 taint
  let res;
  try {
    res = await fetchImageArrayBufferFromBackground(src);
  } catch (e) {
    return {
      ok: false,
      err: e,
    };
  }
  const ab = base64ToArrayBuffer(res);
  const blob = new Blob([ab]);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  // 此时 canvas 未被 taint（因为图像源是我们通过扩展获取并在页面内创建的 Blob URL）
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 假设 jsQR 已经可用于页面
  const qr = jsQR(imageData.data, imageData.width, imageData.height);
  bitmap.close && bitmap.close();

  if (qr) {
    return { ok: true, text: qr.data };
  } else {
    return { ok: false, err: null };
  }
}

// 扫描页面内所有图片并逐一解析
async function scanAllImagesOnPage() {
  let count = 0;
  const imgs = Array.from(document.querySelectorAll("img"));
  for (const img of imgs) {
    const imgSrc = img.src;
    if (!imgSrc || !["png", "jpg", "jpeg"].includes(imgSrc.split(".").at(-1))) {
      continue;
    }
    // 可在页面中做视觉标注：例如在图片上加一个小角标表示正在识别
    const res = await tryDecodeImage(img);
    if (res.ok && res.text) {
      count++;
      console.debug("找到二维码：", res.text, imgSrc);
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        window.open(res.text, "_blank");
      });
    } else {
      console.debug("不是二维码或识别失败：", imgSrc, res.err);
    }
  }
  if (count > 0) {
    showToast(`图片扫描完毕，共找到${count}个二维码`);
  }
}

// 等待页面加载完 jsQR（如果你注入或动态加载 jsQR，需要在此处保证可用）
// 直接执行：
if (typeof jsQR === "function") {
  scanAllImagesOnPage();
} else {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg === "libLoadCompleted") {
      scanAllImagesOnPage();
    }
  });
}
