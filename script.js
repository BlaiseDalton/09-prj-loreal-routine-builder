/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const directionToggle = document.getElementById("directionToggle");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectedProductsButton = document.getElementById(
  "clearSelectedProducts"
);
const selectedProductsStatus = document.getElementById("selectedProductsStatus");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const generateRoutineButton = document.getElementById("generateRoutine");
const workerUrl = "https://lorealchatbot.blaised381.workers.dev/";
const selectedProducts = [];
const selectedProductsStorageKey = "loreal-routine-builder-selected-products";
let isRequestPending = false;
let productsPromise = null;
let filterRequestId = 0;

/* Keep the conversation so the chatbot can answer follow-up questions */
const messages = [
  {
    role: "system",
    content:
      "You are a helpful L'Oréal beauty advisor. Use the full conversation history, including any generated routine, to answer follow-up questions. Stay focused on the routine or related beauty topics such as skincare, haircare, makeup, fragrance, and product use. If asked about unrelated topics, politely redirect the conversation to beauty and routine advice. Give friendly, clear answers with concise headings, numbered steps for routines, bullets for extra details, and short paragraphs. Do not use markdown tables.",
  },
];

/* Switch the page direction while keeping its current language content */
directionToggle.addEventListener("click", () => {
  const isRTL = document.documentElement.dir !== "rtl";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  directionToggle.setAttribute("aria-pressed", String(isRTL));
  directionToggle.textContent = isRTL ? "Use LTR layout" : "Enable RTL layout";
});

/* Load product data from JSON file */
function loadProducts() {
  if (!productsPromise) {
    productsPromise = fetch("products.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load products (HTTP ${response.status}).`);
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.products)) {
          throw new Error("The product list has an unexpected format.");
        }
        return data.products;
      })
      .catch((error) => {
        productsPromise = null;
        throw error;
      });
  }

  return productsPromise;
}

/* Show a helpful message when the grid has no product cards */
function displayProductsMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.className = "placeholder-message";
  messageElement.textContent = message;
  productsContainer.replaceChildren(messageElement);
}

/* Restore saved products when the page loads */
function loadSavedProducts() {
  try {
    const savedProducts = localStorage.getItem(selectedProductsStorageKey);
    if (savedProducts === null) {
      return;
    }

    const parsedProducts = JSON.parse(savedProducts);
    const hasInvalidProduct =
      !Array.isArray(parsedProducts) ||
      parsedProducts.some(
        (product) =>
          !product ||
          !Number.isFinite(product.id) ||
          typeof product.name !== "string" ||
          typeof product.brand !== "string" ||
          typeof product.category !== "string" ||
          typeof product.description !== "string"
      );

    if (hasInvalidProduct) {
      throw new Error("Saved product data has an unexpected format.");
    }

    selectedProducts.push(...parsedProducts);
  } catch (error) {
    console.error("Could not load saved products:", error);
    selectedProductsStatus.textContent =
      "Saved selections could not be loaded. Your current selections may not be saved.";
  }
}

/* Save the current selection so it is available after a page reload */
function saveSelectedProducts() {
  try {
    localStorage.setItem(
      selectedProductsStorageKey,
      JSON.stringify(selectedProducts)
    );
    selectedProductsStatus.textContent = "";
  } catch (error) {
    console.error("Could not save selected products:", error);
    selectedProductsStatus.textContent =
      "Your selections could not be saved on this device.";
  }
}

loadSavedProducts();

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.replaceChildren();

  products.forEach((product) => {
    const isSelected = selectedProducts.some(
      (selectedProduct) => selectedProduct.id === product.id
    );
    const card = document.createElement("article");
    card.className = `product-card${isSelected ? " is-selected" : ""}`;
    card.dataset.productId = product.id;

    const selectButton = document.createElement("button");
    selectButton.className = "product-select";
    selectButton.type = "button";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.setAttribute(
      "aria-label",
      `${isSelected ? "Remove" : "Add"} ${product.name} ${
        isSelected ? "from" : "to"
      } selected products`
    );

    const image = document.createElement("img");
    image.src = product.image;
    image.alt = "";

    const productInfo = document.createElement("span");
    productInfo.className = "product-info";

    const productName = document.createElement("span");
    productName.className = "product-name";
    productName.dir = "auto";
    productName.textContent = product.name;

    const brandName = document.createElement("span");
    brandName.className = "product-brand";
    brandName.dir = "auto";
    brandName.textContent = product.brand;

    productInfo.append(productName, brandName);
    selectButton.append(image, productInfo);
    selectButton.addEventListener("click", () => {
      toggleProductSelection(product);
    });

    const descriptionId = `product-description-${product.id}`;
    const descriptionButton = document.createElement("button");
    descriptionButton.className = "product-description-toggle";
    descriptionButton.type = "button";
    descriptionButton.textContent = "Show description";
    descriptionButton.setAttribute("aria-expanded", "false");
    descriptionButton.setAttribute("aria-controls", descriptionId);

    const description = document.createElement("p");
    description.className = "product-description";
    description.id = descriptionId;
    description.dir = "auto";
    description.textContent = product.description;
    description.hidden = true;

    descriptionButton.addEventListener("click", () => {
      const isExpanded =
        descriptionButton.getAttribute("aria-expanded") === "true";
      descriptionButton.setAttribute("aria-expanded", String(!isExpanded));
      descriptionButton.textContent = isExpanded
        ? "Show description"
        : "Hide description";
      description.hidden = isExpanded;
    });

    card.append(selectButton, descriptionButton, description);
    productsContainer.appendChild(card);
  });
}

/* Keep the product grid and selected list in sync */
function updateProductSelection() {
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    const isSelected = selectedProducts.some(
      (product) => String(product.id) === card.dataset.productId
    );
    card.classList.toggle("is-selected", isSelected);
    const selectButton = card.querySelector(".product-select");
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.setAttribute(
      "aria-label",
      `${isSelected ? "Remove" : "Add"} ${
        selectButton.querySelector(".product-name").textContent
      } ${isSelected ? "from" : "to"} selected products`
    );
  });

  selectedProductsList.replaceChildren();
  clearSelectedProductsButton.disabled = selectedProducts.length === 0;
  if (selectedProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "selected-products-empty";
    emptyMessage.textContent = "No products selected yet.";
    selectedProductsList.appendChild(emptyMessage);
    return;
  }

  selectedProducts.forEach((product) => {
    const productItem = document.createElement("div");
    productItem.className = "selected-product";

    const productName = document.createElement("span");
    productName.dir = "auto";
    productName.textContent = `${product.name} · ${product.brand}`;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-product-btn";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${product.name}`);
    removeButton.addEventListener("click", () => {
      toggleProductSelection(product);
    });

    productItem.append(productName, removeButton);
    selectedProductsList.appendChild(productItem);
  });
}

/* Add or remove a product, then update both parts of the page */
function toggleProductSelection(product) {
  const selectedIndex = selectedProducts.findIndex(
    (selectedProduct) => selectedProduct.id === product.id
  );

  if (selectedIndex === -1) {
    selectedProducts.push(product);
  } else {
    selectedProducts.splice(selectedIndex, 1);
  }

  saveSelectedProducts();
  updateProductSelection();
}

/* Filter products by both selected category and typed search words */
async function updateProductResults() {
  const requestId = ++filterRequestId;
  const selectedCategory = categoryFilter.value;
  const searchWords = productSearch.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!selectedCategory && searchWords.length === 0) {
    displayProductsMessage("Choose a category or search for a product.");
    return;
  }

  try {
    const products = await loadProducts();
    if (requestId !== filterRequestId) {
      return;
    }

    const filteredProducts = products.filter((product) => {
      const matchesCategory =
        !selectedCategory || product.category === selectedCategory;
      const searchableText = [
        product.name,
        product.brand,
        product.category,
        product.description,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchWords.every((word) =>
        searchableText.includes(word)
      );

      return matchesCategory && matchesSearch;
    });

    if (filteredProducts.length === 0) {
      displayProductsMessage("No products match. Try another name or keyword.");
      return;
    }

    displayProducts(filteredProducts);
  } catch (error) {
    if (requestId === filterRequestId) {
      console.error("Could not filter products:", error);
      displayProductsMessage("Products could not be loaded. Please try again.");
    }
  }
}

categoryFilter.addEventListener("change", updateProductResults);
productSearch.addEventListener("input", updateProductResults);

clearSelectedProductsButton.addEventListener("click", () => {
  selectedProducts.length = 0;
  saveSelectedProducts();
  updateProductSelection();
  displayProductsMessage("Choose a category or search for a product.");
});

updateProductSelection();

/* Add safe text and simple bold emphasis without inserting HTML */
function addFormattedText(parent, text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = document.createElement("strong");
      boldText.textContent = part.slice(2, -2);
      parent.appendChild(boldText);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  });
}

/* Render common heading and list formats as readable page elements */
function displayFormattedResponse(container, content) {
  let currentList = null;
  let currentListType = "";

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      currentList = null;
      currentListType = "";
      return;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      const heading = document.createElement("h3");
      addFormattedText(heading, headingMatch[1]);
      container.appendChild(heading);
      currentList = null;
      currentListType = "";
      return;
    }

    const numberedItem = line.match(/^\d+[.)]\s+(.+)$/);
    const bulletItem = line.match(/^[-*•]\s+(.+)$/);
    const listItem = numberedItem || bulletItem;
    if (listItem) {
      const listType = numberedItem ? "ol" : "ul";
      if (!currentList || currentListType !== listType) {
        currentList = document.createElement(listType);
        container.appendChild(currentList);
        currentListType = listType;
      }

      const listElement = document.createElement("li");
      addFormattedText(listElement, listItem[1]);
      currentList.appendChild(listElement);
      return;
    }

    const paragraph = document.createElement("p");
    addFormattedText(paragraph, line);
    container.appendChild(paragraph);
    currentList = null;
    currentListType = "";
  });
}

/* Display each chat message with a clear speaker label */
function displayChatMessage(speaker, content) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message chat-message-${speaker.toLowerCase()}`;

  const speakerLabel = document.createElement("span");
  speakerLabel.className = "chat-message-speaker";
  speakerLabel.textContent = speaker;

  const messageContent = document.createElement("div");
  messageContent.className = "chat-message-content";
  messageContent.dir = "auto";
  if (speaker === "Advisor") {
    displayFormattedResponse(messageContent, content);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = content;
    messageContent.appendChild(paragraph);
  }

  messageElement.append(speakerLabel, messageContent);
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send a user message and the conversation history to the Cloudflare Worker */
async function sendMessageToChatbot(messageContent, displayContent = messageContent) {
  if (isRequestPending) {
    return;
  }

  isRequestPending = true;
  messages.push({ role: "user", content: messageContent });
  displayChatMessage("You", displayContent);
  sendBtn.disabled = true;
  generateRoutineButton.disabled = true;

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Chatbot request failed (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The chatbot returned an empty response.");
    }

    messages.push({ role: "assistant", content: reply });
    displayChatMessage("Advisor", reply);
  } catch (error) {
    messages.pop();
    console.error("Chatbot request failed:", error);
    displayChatMessage(
      "Advisor",
      error.message.startsWith("Chatbot request failed")
        ? error.message
        : "Sorry, I couldn't get a response. Please try again."
    );
  } finally {
    isRequestPending = false;
    sendBtn.disabled = false;
    generateRoutineButton.disabled = false;
    userInput.focus();
  }
}

/* Send chat questions to the same conversation */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isRequestPending) {
    return;
  }

  const question = userInput.value.trim();
  if (!question) {
    return;
  }

  userInput.value = "";
  await sendMessageToChatbot(question);
});

/* Ask the chatbot to build a routine using only the selected product data */
generateRoutineButton.addEventListener("click", async () => {
  if (isRequestPending) {
    return;
  }

  if (selectedProducts.length === 0) {
    displayChatMessage(
      "Advisor",
      "Select at least one product before generating a routine."
    );
    return;
  }

  const productData = selectedProducts.map(
    ({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    })
  );
  const routineRequest = `Create a personalized routine using only these selected products. Explain the order and how to use each product. Do not recommend products that are not in the list. Product data (JSON):\n${JSON.stringify(
    productData,
    null,
    2
  )}`;

  await sendMessageToChatbot(
    routineRequest,
    "Generate a routine using my selected products."
  );
});
