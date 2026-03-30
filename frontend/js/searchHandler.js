/**
 * Universal Search Handler for Aceos Affiliate Store
 * Supports Products, Ads, and Static Pages
 */

document.addEventListener('DOMContentLoaded', () => {
    // Populate Category Dropdowns
    const categorySelects = document.querySelectorAll('select.search-category, #searchCategory');
    if (categorySelects.length > 0) {
        fetch('/api/products/categories')
            .then(res => res.json())
            .then(categories => {
                categorySelects.forEach(select => {
                    const firstOption = select.options[0];
                    select.innerHTML = '';
                    select.appendChild(firstOption);

                    categories.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat;
                        option.textContent = cat;
                        select.appendChild(option);
                    });
                });
            })
            .catch(err => console.error('Error loading categories:', err));
    }

    // Handle Search Form Submissions
    const searchForms = document.querySelectorAll('.search-form');
    searchForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const keywordInput = form.querySelector('input[type="search"]');
            const categorySelect = form.querySelector('select');
            const categoryHidden = form.querySelector('input[name="category"]');

            const q = keywordInput ? keywordInput.value : '';
            let category = '0';
            if (categorySelect) category = categorySelect.value;
            else if (categoryHidden) category = categoryHidden.value;

            window.location.href = `category.html?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`;
        });
    });

    // If we are on category.html, perform the universal search
    if (window.location.pathname.includes('category.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q');
        const category = urlParams.get('category');

        if (q || (category && category !== '0')) {
            performUniversalSearch(q, category);
        }
    }
});

function performUniversalSearch(q, category) {
    let resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) {
        // Try to find a suitable container if searchResults ID is missing
        resultsContainer = document.querySelector('.latest-coupon .row:last-child') ||
            document.querySelector('main .container .row:last-child');
    }
    if (!resultsContainer) return;

    const searchTerm = (q || '').toLowerCase();
    resultsContainer.innerHTML = '<div class="col-xs-12 text-center" style="padding: 60px;"><i class="fa fa-spinner fa-spin fa-3x" style="color: #ff3366;"></i><p style="margin-top:20px; font-weight:500;">Searching for the best deals and pages...</p></div>';

    fetch(`/api/products/search?q=${encodeURIComponent(q || '')}&category=${encodeURIComponent(category || '0')}`)
        .then(res => res.json())
        .then(results => {
            resultsContainer.innerHTML = '';

            if (results.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="col-xs-12 text-center" style="padding: 80px 20px;">
                        <img src="images/no-results.png" alt="No results" style="max-width: 150px; margin-bottom: 20px; opacity: 0.5;" onerror="this.style.display='none'">
                        <h3>Oops! No results found for "${q}"</h3>
                        <p>Try searching for different keywords or browse our <a href="category.html" style="color:#ff3366; font-weight:bold;">categories</a>.</p>
                    </div>`;
                return;
            }

            // Results summary
            const summaryHtml = `<div class="col-xs-12" style="margin-bottom: 30px;"><p style="font-size: 16px; color: #666;">Found <strong>${results.length}</strong> matches for "${q || 'everything'}"</p></div>`;
            resultsContainer.insertAdjacentHTML('beforeend', summaryHtml);

            results.forEach(item => {
                let itemHtml = '';
                const typeLabel = item.type.toUpperCase();
                // Brand color: #ff3366 (estimated from CSS earlier)
                const typeColor = item.type === 'product' ? '#28a745' : (item.type === 'page' ? '#ff3366' : '#ffc107');

                // Highlighting helper
                const highlight = (text) => {
                    if (!searchTerm || !text) return text;
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    return text.replace(regex, '<mark class="search-highlight" style="background: yellow; color: inherit; padding: 0 2px;">$1</mark>');
                };

                const displayTitle = highlight(item.title);
                const displayDesc = highlight(item.description || item.content || '');

                if (item.type === 'product') {
                    itemHtml = `
                        <div class="col-xs-12 col-sm-6 col-md-3">
                            <div class="coupon-box mar-bottom-xs" style="transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div class="img-holder" style="height: 180px; overflow: hidden; display: flex; align-items: center; background: #f9f9f9;">
                                    <img src="${item.image_url || 'images/img02.jpg'}" alt="${item.title}" class="img-resposnive" style="width:100%; object-fit: cover;" loading="lazy">
                                    <span class="type-badge" style="position:absolute; top:10px; right:10px; background:${typeColor}; color:#fff; padding:2px 10px; border-radius:15px; font-size:10px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${typeLabel}</span>
                                </div>
                                <div class="txt-holder" style="padding: 15px;">
                                    <h3 class="heading6" style="height: 44px; overflow: hidden; margin-bottom: 10px;"><a href="coupon-detail.html?id=${item.id}">${displayTitle}</a></h3>
                                    <p style="font-size:12px; color:#777; height:45px; overflow:hidden; line-height: 1.4;">${displayDesc}</p>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
                                        <span class="price" style="font-size: 18px; color: #ff3366; font-weight: 800;">$${item.price}</span>
                                        <a href="coupon-detail.html?id=${item.id}" class="btn-primary md-round text-center text-uppercase" style="padding: 5px 15px; font-size: 11px;">View Deal</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'page') {
                    itemHtml = `
                        <div class="col-xs-12 col-sm-6 col-md-3">
                            <div class="coupon-box mar-bottom-xs" style="border-top: 4px solid ${typeColor}; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div class="txt-holder" style="padding: 25px 20px; text-align: center;">
                                    <span style="color:${typeColor}; font-size:11px; font-weight:bold; display:block; margin-bottom:10px; letter-spacing: 1px;">SYSTEM PAGE</span>
                                    <h3 class="heading6" style="margin-bottom: 15px;"><a href="${item.url}">${displayTitle}</a></h3>
                                    <p style="font-size:13px; color:#666; height: 55px; overflow: hidden;">${displayDesc}</p>
                                    <a href="${item.url}" class="btn-primary md-round text-center text-uppercase" style="margin-top:20px; border-color:${typeColor}; background:transparent; color:${typeColor}; display: inline-block;">Explore</a>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'ad') {
                    itemHtml = `
                        <div class="col-xs-12 col-sm-6 col-md-3">
                            <div class="coupon-box mar-bottom-xs" style="border-top: 4px solid ${typeColor}; border-radius: 8px; overflow: hidden;">
                                <div class="img-holder" style="height: 150px; overflow: hidden;">
                                    <img src="${item.image_url || 'images/img03.jpg'}" alt="${item.title}" class="img-resposnive" style="width:100%; object-fit: cover;" loading="lazy">
                                    <span class="type-badge" style="position:absolute; top:10px; right:10px; background:${typeColor}; color:#000; padding:2px 10px; border-radius:15px; font-size:10px; font-weight:bold;">SPONSORED</span>
                                </div>
                                <div class="txt-holder" style="padding: 15px;">
                                    <h3 class="heading6" style="height: 44px; overflow: hidden;"><a href="${item.target_url}" target="_blank">${displayTitle}</a></h3>
                                    <p style="font-size:12px; color:#777; height:45px; overflow:hidden;">${displayDesc}</p>
                                    <a href="${item.target_url}" target="_blank" class="btn-primary md-round text-center text-uppercase" style="background:${typeColor}; border-color:${typeColor}; color:#000; width: 100%; margin-top: 10px;">Go to Site</a>
                                </div>
                            </div>
                        </div>
                    `;
                }

                resultsContainer.insertAdjacentHTML('beforeend', itemHtml);
            });
        })
        .catch(err => {
            console.error('Search error:', err);
            resultsContainer.innerHTML = `
                <div class="col-xs-12 text-center" style="padding: 60px;">
                    <i class="fa fa-exclamation-triangle fa-3x" style="color: #d9534f; margin-bottom: 20px;"></i>
                    <h3 class="text-danger">Search Failed</h3>
                    <p>There was an error connecting to our deal engine. Please try again in a moment.</p>
                    <button onclick="location.reload()" class="btn btn-default" style="margin-top: 15px;">Retry Search</button>
                </div>`;
        });
}
