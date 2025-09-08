import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    const app = document.getElementById('app');
    const bookForm = document.getElementById('book-form');
    const bookCreationStep = document.getElementById('book-creation-step');
    const pageViewStep = document.getElementById('page-view-step');
    const pageContainer = document.getElementById('page-container');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    const swapSidesButton = document.getElementById('swap-sides');

    let currentPage = 0;
    let totalPages = 0;
    let apiKey;
    let genAI;
    let pageData = [];

    // --- Splash Screen ---
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        app.classList.remove('hidden');
        apiKey = prompt("Please enter your Gemini API Key:");
        if (apiKey) {
            genAI = new GoogleGenerativeAI(apiKey);
        } else {
            alert("API Key is required to generate stories.");
        }
    }, 2000);

    // --- Book Creation ---
    bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!apiKey) {
            alert("Please provide an API key to generate a story.");
            return;
        }

        const pageCount = document.getElementById('page-count').value;
        const storyPrompt = document.getElementById('story-prompt').value;
        const submitButton = bookForm.querySelector('button[type="submit"]');

        totalPages = parseInt(pageCount, 10);

        submitButton.disabled = true;
        submitButton.textContent = 'יוצר סיפור...';

        try {
            const story = await generateStory(storyPrompt, totalPages);
            createPages(story);
            bookCreationStep.classList.add('hidden');
            pageViewStep.classList.remove('hidden');
            showPage(0);
        } catch (error) {
            console.error("Error generating story:", error);
            alert(`Failed to generate story: ${error.message}. Please ensure your API key is correct and try again.`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'צור סיפור';
        }
    });

    async function generateStory(prompt, numPages) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
        const fullPrompt = `כתוב סיפור ילדים בנושא "${prompt}". הסיפור צריך להיות מחולק ל-${numPages} עמודים. אנא החזר את הסיפור בפורמט JSON, כאשר כל עמוד הוא מחרוזת במערך. לדוגמה: ["תוכן עמוד 1", "תוכן עמוד 2"].`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = await response.text();

        // Clean the response to get only the JSON part
        const jsonString = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);

        try {
            const pages = JSON.parse(jsonString);
            if (Array.isArray(pages) && pages.length > 0) {
                return pages;
            }
        } catch (e) {
            console.error("Failed to parse story JSON:", e);
        }

        // Fallback if JSON parsing fails
        return ["הסיפור לא נוצר כראוי. אנא נסה שוב."];
    }

    function createPages(story) {
        pageContainer.innerHTML = '';
        pageData = []; // Reset page data
        story.forEach((pageText, index) => {
            pageData.push({
                imageHistory: [],
                currentImageIndex: -1,
            });

            const pageElement = document.createElement('div');
            pageElement.classList.add('page');
            pageElement.dataset.pageIndex = index;

            pageElement.innerHTML = `
                <div class="page-content" contenteditable="true">
                    ${pageText}
                </div>
                <div class="page-image-placeholder">
                     <span class="material-symbols-outlined">
                        image
                    </span>
                    <button class="generate-image-btn">צור תמונה</button>
                </div>
            `;
            pageContainer.appendChild(pageElement);
        });
    }

    // --- Page Navigation ---
    function showPage(pageIndex) {
        const pages = document.querySelectorAll('.page');
        pages.forEach((page, index) => {
            page.classList.toggle('hidden', index !== pageIndex);
        });
        currentPage = pageIndex;
        pageIndicator.textContent = `עמוד ${currentPage + 1} מתוך ${totalPages}`;
        prevPageButton.disabled = currentPage === 0;
        nextPageButton.disabled = currentPage === totalPages - 1;
    }

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 0) {
            showPage(currentPage - 1);
        }
    });

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
            showPage(currentPage + 1);
        }
    });

    swapSidesButton.addEventListener('click', () => {
        const pages = document.querySelectorAll('.page');
        pages[currentPage].classList.toggle('reverse');
    });

    pageContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const pageElement = target.closest('.page');
        if (!pageElement) return;

        const pageIndex = parseInt(pageElement.dataset.pageIndex, 10);

        if (target.classList.contains('generate-image-btn') || target.classList.contains('edit-image-btn')) {
            const imagePrompt = prompt("Enter a prompt for the image:");
            if (imagePrompt) {
                target.disabled = true;
                target.textContent = 'יוצר תמונה...';
                try {
                    const imageUrl = await generateImage(imagePrompt);
                    updateImage(pageIndex, imageUrl, imagePrompt, true);
                } catch (error) {
                    console.error("Error generating image:", error);
                    alert(`Failed to generate image: ${error.message}`);
                } finally {
                    target.disabled = false;
                    target.textContent = target.classList.contains('generate-image-btn') ? 'צור תמונה' : 'ערוך תמונה';
                }
            }
        } else if (target.classList.contains('prev-image-btn')) {
            const page = pageData[pageIndex];
            if (page.currentImageIndex > 0) {
                page.currentImageIndex--;
                const { url, prompt } = page.imageHistory[page.currentImageIndex];
                updateImage(pageIndex, url, prompt, false);
            }
        } else if (target.classList.contains('download-image-btn')) {
            const imageUrl = pageElement.querySelector('img').src;
            window.open(imageUrl, '_blank');
        }
    });

    function updateImage(pageIndex, imageUrl, prompt, isNew) {
        const page = pageData[pageIndex];
        if (isNew) {
            // If we are adding a new image after going back in history,
            // we should remove the future images.
            page.imageHistory.splice(page.currentImageIndex + 1);
            page.imageHistory.push({ url: imageUrl, prompt: prompt });
            page.currentImageIndex = page.imageHistory.length - 1;
        }

        const pageElement = document.querySelector(`.page[data-page-index="${pageIndex}"]`);
        const imagePlaceholder = pageElement.querySelector('.page-image-placeholder');

        imagePlaceholder.innerHTML = `
            <img src="${imageUrl}" alt="${prompt}" style="width: 100%; height: 100%; object-fit: cover;">
            <div class="image-controls">
                <button class="edit-image-btn">ערוך תמונה</button>
                <button class="prev-image-btn" ${page.currentImageIndex === 0 ? 'disabled' : ''}>תמונה קודמת</button>
                <button class="download-image-btn">הורד תמונה</button>
            </div>
        `;
    }

    async function generateImage(prompt) {
        // NOTE: As of my last update, direct text-to-image generation with 'gemini-pro'
        // in the way shown below is not the standard way. The correct model would be
        // something like 'imagen'. However, without clear documentation on its usage with
        // this specific library, I'm using a creative prompt with 'gemini-1.5-flash-latest' as a placeholder.
        // This part of the code will likely need to be updated once the correct API usage is found.

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); // Using gemini-1.5-flash-latest as a placeholder
        const fullPrompt = `צור תמונה המתארת: "${prompt}". במקום התמונה, החזר כתובת URL של תמונה מ-Unsplash שתתאר את התמונה.`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = await response.text();

        // This is a simplified and fragile way to extract a URL.
        // A more robust solution would be needed for a real application.
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            return urlMatch[0];
        }

        // Fallback image if no URL is found
        return 'https://via.placeholder.com/400';
    }

    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
        circle.classList.add("ripple");

        const ripple = button.getElementsByClassName("ripple")[0];
        if (ripple) {
            ripple.remove();
        }

        button.appendChild(circle);
    }

    const buttons = document.getElementsByTagName("button");
    for (const button of buttons) {
        button.addEventListener("mousedown", createRipple);
    }

    document.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') {
            createRipple(e);
        }
    });
});
