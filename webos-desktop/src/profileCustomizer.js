import { desktop } from "./desktop.js";

const STORAGE_KEYS = {
  username: "yukiOS_username",
  profilePicture: "yukiOS_profilePicture"
};

const PREDEFINED_AVATARS = [
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/guest.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/helltaker.jpg",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/stardew.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/hollowKnight.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/fancypants2.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/isaac.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/angryBirds.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/nso.webp",
  "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main/static/icons/alienHominid.webp"
];

export class ProfileCustomizerApp {
  constructor(windowManager, settingsApp = null) {
    this.wm = windowManager;
    this.settingsApp = settingsApp;
  }

  setSettingsApp(settingsApp) {
    this.settingsApp = settingsApp;
  }

  open() {
    const winId = "profile-customizer";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const currentUsername = localStorage.getItem(STORAGE_KEYS.username) || "Reeyuki";
    const currentProfilePic = localStorage.getItem(STORAGE_KEYS.profilePicture) || "static/icons/guest.webp";

    const win = this.wm.createWindow(winId, "Customize Profile", "420px", "580px");
    Object.assign(win.style, { left: "250px", top: "100px" });

    win.innerHTML = `
      <div class="window-header">
        <span>Customize Profile</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="profile-customizer-body" style="padding: 24px; display: flex; flex-direction: column; gap: 24px; height: calc(100% - 48px); overflow-y: auto;">
        
        <!-- Current Profile Preview -->
        <div class="profile-preview" style="display: flex; align-items: center; gap: 16px; padding: 20px; background: linear-gradient(135deg, rgba(79, 158, 255, 0.15), rgba(79, 158, 255, 0.05)); border-radius: 12px; border: 1px solid rgba(79, 158, 255, 0.3);">
          <div class="profile-preview-img" style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 3px solid var(--brand); box-shadow: 0 4px 15px rgba(79, 158, 255, 0.3);">
            <img id="profile-preview-img" src="${currentProfilePic}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div class="profile-preview-info">
            <div id="profile-preview-name" style="font-size: 20px; font-weight: 600; color: #fff;">${currentUsername}</div>
            <div style="font-size: 13px; color: var(--tx2);">Your profile will look like this</div>
          </div>
        </div>

        <!-- Nickname Section -->
        <div class="profile-section" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 14px; font-weight: 600; color: var(--tx1); display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-user"></i> Nickname
          </div>
          <input id="profile-username-input" type="text" value="${currentUsername}" placeholder="Enter your nickname" style="padding: 12px 16px; border-radius: var(--r-sm); border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; font-size: 15px; outline: none; transition: border-color 0.15s;" />
        </div>

        <!-- Profile Picture Section -->
        <div class="profile-section" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 14px; font-weight: 600; color: var(--tx1); display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-image"></i> Profile Picture
          </div>
          
          <!-- Upload Button -->
          <button id="profile-upload-btn" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px; background: linear-gradient(135deg, rgba(79, 158, 255, 0.2), rgba(79, 158, 255, 0.1)); border: 2px dashed rgba(79, 158, 255, 0.4); border-radius: var(--r-sm); color: var(--tx1); cursor: pointer; transition: all 0.15s; font-size: 14px;">
            <i class="fas fa-cloud-upload-alt" style="font-size: 18px;"></i>
            <span>Upload Custom Image</span>
          </button>
          
          <!-- Predefined Avatars -->
          <div style="font-size: 13px; color: var(--tx2); margin-top: 4px;">Or choose a predefined avatar:</div>
          <div class="avatar-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; max-height: 200px; overflow-y: auto; padding: 4px;">
            ${PREDEFINED_AVATARS.map(
              (avatar) => `
              <div class="avatar-option ${avatar === currentProfilePic ? "selected" : ""}" data-src="${avatar}" style="width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; cursor: pointer; border: 3px solid ${avatar === currentProfilePic ? "var(--brand)" : "transparent"}; transition: all 0.15s; position: relative;">
                <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
                ${avatar === currentProfilePic ? '<div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;"><i class="fas fa-check" style="color: #fff; font-size: 16px;"></i></div>' : ""}
              </div>
            `
            ).join("")}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="profile-save-btn" style="flex: 1; padding: 14px; background: linear-gradient(to right, #47b230, #5ab941); border: none; border-radius: var(--r-sm); color: #fff; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fas fa-save"></i> Save Changes
          </button>
          <button id="profile-reset-btn" style="padding: 14px 20px; background: rgba(255,255,255,0.1); border: none; border-radius: var(--r-sm); color: var(--tx2); cursor: pointer; transition: all 0.15s;">
            <i class="fas fa-undo"></i> Reset
          </button>
        </div>

        <!-- Status Message -->
        <div id="profile-status" style="text-align: center; font-size: 13px; color: #5ab941; opacity: 0; transition: opacity 0.3s;">Profile updated successfully!</div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Customize Profile", "fas fa-user-circle", "#4f9eff");

    this._bindEvents(win, currentUsername, currentProfilePic);
  }

  _bindEvents(win, originalUsername, originalProfilePic) {
    const usernameInput = win.querySelector("#profile-username-input");
    const uploadBtn = win.querySelector("#profile-upload-btn");
    const saveBtn = win.querySelector("#profile-save-btn");
    const resetBtn = win.querySelector("#profile-reset-btn");
    const previewImg = win.querySelector("#profile-preview-img");
    const previewName = win.querySelector("#profile-preview-name");
    const avatarOptions = win.querySelectorAll(".avatar-option");
    const statusMsg = win.querySelector("#profile-status");

    let selectedAvatar = originalProfilePic;
    let customImageDataUrl = null;

    // Username input handler
    usernameInput.addEventListener("input", () => {
      previewName.textContent = usernameInput.value || "Reeyuki";
    });

    usernameInput.addEventListener("focus", () => {
      usernameInput.style.borderColor = "var(--brand)";
    });

    usernameInput.addEventListener("blur", () => {
      usernameInput.style.borderColor = "rgba(255,255,255,0.1)";
    });

    // Avatar selection
    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        // Remove selection from all
        avatarOptions.forEach((opt) => {
          opt.classList.remove("selected");
          opt.style.borderColor = "transparent";
          const check = opt.querySelector("div");
          if (check) check.remove();
        });

        // Add selection to clicked
        option.classList.add("selected");
        option.style.borderColor = "var(--brand)";
        selectedAvatar = option.dataset.src;
        customImageDataUrl = null;

        // Add checkmark
        option.innerHTML += `
          <div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-check" style="color: #fff; font-size: 16px;"></i>
          </div>
        `;

        // Update preview
        previewImg.src = selectedAvatar;
      });

      // Hover effects
      option.addEventListener("mouseenter", () => {
        if (!option.classList.contains("selected")) {
          option.style.borderColor = "rgba(79, 158, 255, 0.5)";
          option.style.transform = "scale(1.05)";
        }
      });

      option.addEventListener("mouseleave", () => {
        if (!option.classList.contains("selected")) {
          option.style.borderColor = "transparent";
          option.style.transform = "scale(1)";
        }
      });
    });

    // Upload handler
    uploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;

        try {
          if (file.size > 2 * 1024 * 1024) {
            alert("Image too large. Please use a file under 2MB.");
            return;
          }

          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });

          if (!dataUrl.startsWith("data:")) throw new Error("Invalid image file.");

          customImageDataUrl = dataUrl;
          selectedAvatar = dataUrl;

          // Update preview
          previewImg.src = dataUrl;

          // Clear predefined selections
          avatarOptions.forEach((opt) => {
            opt.classList.remove("selected");
            opt.style.borderColor = "transparent";
            const check = opt.querySelector("div");
            if (check) check.remove();
          });

          // Show upload success visual
          uploadBtn.style.borderColor = "#5ab941";
          uploadBtn.style.background = "linear-gradient(135deg, rgba(90, 185, 65, 0.2), rgba(90, 185, 65, 0.1))";
          uploadBtn.innerHTML = `<i class="fas fa-check" style="font-size: 18px; color: #5ab941;"></i><span style="color: #5ab941;">Image Uploaded</span>`;

          setTimeout(() => {
            uploadBtn.style.borderColor = "rgba(79, 158, 255, 0.4)";
            uploadBtn.style.background = "linear-gradient(135deg, rgba(79, 158, 255, 0.2), rgba(79, 158, 255, 0.1))";
            uploadBtn.innerHTML = `<i class="fas fa-cloud-upload-alt" style="font-size: 18px;"></i><span>Upload Custom Image</span>`;
          }, 2000);
        } catch (e) {
          console.error("Upload failed:", e);
          alert("Failed to upload image. Check console for details.");
        }
      });

      input.click();
    });

    // Hover effect for upload button
    uploadBtn.addEventListener("mouseenter", () => {
      uploadBtn.style.borderColor = "var(--brand)";
      uploadBtn.style.background = "linear-gradient(135deg, rgba(79, 158, 255, 0.3), rgba(79, 158, 255, 0.15))";
    });

    uploadBtn.addEventListener("mouseleave", () => {
      if (!uploadBtn.innerHTML.includes("fa-check")) {
        uploadBtn.style.borderColor = "rgba(79, 158, 255, 0.4)";
        uploadBtn.style.background = "linear-gradient(135deg, rgba(79, 158, 255, 0.2), rgba(79, 158, 255, 0.1))";
      }
    });

    // Save handler
    saveBtn.addEventListener("click", () => {
      const newUsername = usernameInput.value.trim() || "Reeyuki";
      const newProfilePic = customImageDataUrl || selectedAvatar;

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.username, newUsername);
      localStorage.setItem(STORAGE_KEYS.profilePicture, newProfilePic);

      // Update window._settings if available
      if (window._settings) {
        window._settings.username = newUsername;
      }

      // Update settings app if available
      if (this.settingsApp) {
        this.settingsApp.updateUsername(newUsername);
      }

      // Update start menu user display
      const startUserSpan = document.querySelector(".start-user span");
      if (startUserSpan) startUserSpan.textContent = newUsername;

      const startUserImg = document.querySelector(".start-user img");
      if (startUserImg) startUserImg.src = newProfilePic;

      // Show success message
      statusMsg.style.opacity = "1";
      setTimeout(() => {
        statusMsg.style.opacity = "0";
      }, 2200);
    });

    // Reset handler
    resetBtn.addEventListener("click", () => {
      usernameInput.value = originalUsername;
      previewName.textContent = originalUsername;
      selectedAvatar = originalProfilePic;
      customImageDataUrl = null;
      previewImg.src = originalProfilePic;

      // Reset avatar selections
      avatarOptions.forEach((opt) => {
        opt.classList.remove("selected");
        opt.style.borderColor = "transparent";
        const check = opt.querySelector("div");
        if (check) check.remove();

        if (opt.dataset.src === originalProfilePic) {
          opt.classList.add("selected");
          opt.style.borderColor = "var(--brand)";
          opt.innerHTML += `
            <div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-check" style="color: #fff; font-size: 16px;"></i>
            </div>
          `;
        }
      });
    });

    // Hover effects for buttons
    saveBtn.addEventListener("mouseenter", () => {
      saveBtn.style.transform = "translateY(-2px)";
      saveBtn.style.boxShadow = "0 4px 15px rgba(90, 185, 65, 0.4)";
    });

    saveBtn.addEventListener("mouseleave", () => {
      saveBtn.style.transform = "translateY(0)";
      saveBtn.style.boxShadow = "none";
    });

    resetBtn.addEventListener("mouseenter", () => {
      resetBtn.style.background = "rgba(255,255,255,0.15)";
    });

    resetBtn.addEventListener("mouseleave", () => {
      resetBtn.style.background = "rgba(255,255,255,0.1)";
    });
  }
}
