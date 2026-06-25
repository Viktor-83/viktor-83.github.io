document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    const html = document.documentElement;

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
        });
    }

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        const currentUrl = window.location.href;
        
        if (currentUrl.includes('_eng.html')) {
            langToggle.innerText = 'FR';
        } else {
            langToggle.innerText = 'EN';
        }

        langToggle.addEventListener('click', () => {
            const url = window.location.href;
            
            if (url.includes('_eng.html')) {
                window.location.href = url.replace('_eng.html', '.html');
            } else {
                if (!url.includes('.html')) {
                    const separator = url.endsWith('/') ? '' : '/';
                    window.location.href = url + separator + 'index_eng.html';
                } else {
                    window.location.href = url.replace('.html', '_eng.html');
                }
            }
        });
    }

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    const asciiLoader = document.getElementById('ascii-loader');
    if (asciiLoader) {
        let size = 15;
        let progress = 0;
        setInterval(() => {
            let bar = '[';
            for(let i = 0; i < size; i++) {
                if(i < progress) bar += '=';
                else if(i === progress) bar += '>';
                else bar += '.';
            }
            bar += ']';
            asciiLoader.innerHTML = "home@hacqueranque:~$&nbsp;" + bar;
            progress++;
            if (progress > size) {
                progress = 0;
            }
        }, 150);
    }

    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('click', () => {
            const content = card.querySelector('.project-content');
            if (!content) return; 

            const isOpen = content.style.maxHeight;

            projectCards.forEach(c => {
                const cContent = c.querySelector('.project-content');
                if (cContent) {
                    cContent.style.maxHeight = null;
                    cContent.style.opacity = '0';
                }
            });

            if (!isOpen) {
                content.style.maxHeight = content.scrollHeight + "px";
                content.style.opacity = '1';
            }
        });
    });

    const form = document.querySelector('form[name="contactForm"]');
    if(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.reload();
        });
    }

    const carousels = document.querySelectorAll('.dynamic-carousel');
    carousels.forEach(carousel => {
        const track = carousel.querySelector('.carousel-track');
        const folder = carousel.getAttribute('data-folder'); 
        const ext = carousel.getAttribute('data-ext') || 'jpg';
        const maxImages = parseInt(carousel.getAttribute('data-max')) || 15; 

        let loadedImages = [];
        let promises = [];

        for (let i = 1; i <= maxImages; i++) {
            let img = new Image();
            img.src = `${folder}${i}.${ext}`; 
            
            let p = new Promise((resolve) => {
                img.onload = () => {
                    img.className = "w-full h-full flex-shrink-0 object-cover pointer-events-none";
                    loadedImages.push({index: i, element: img});
                    resolve();
                };
                img.onerror = () => resolve(); 
            });
            promises.push(p);
        }

        Promise.all(promises).then(() => {
            loadedImages.sort((a, b) => a.index - b.index);
            track.innerHTML = '';
            
            if (loadedImages.length === 0) {
                track.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-500 text-center px-4">
                    <p class="font-bold">No images found</p>
                    <p class="text-sm">Add images named 1.${ext}, 2.${ext}... in ${folder}</p>
                </div>`;
            } else {
                loadedImages.forEach(item => track.appendChild(item.element));
                setupCarouselControls(carousel, loadedImages.length, folder);
            }
        });
    });

    function setupCarouselControls(carousel, totalSlides, folder) {
        const track = carousel.querySelector('.carousel-track');
        const nextBtn = carousel.querySelector('.next-btn');
        const prevBtn = carousel.querySelector('.prev-btn');
        const indicatorContainer = carousel.querySelector('.carousel-indicators');
        let currentIndex = 0;

        indicatorContainer.innerHTML = '';

        for(let i=0; i<totalSlides; i++) {
            const dot = document.createElement('span');
            if(i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => updateCarousel(i));
            indicatorContainer.appendChild(dot);
        }
        const dots = Array.from(indicatorContainer.children);

        const updateCarousel = (index) => {
            track.style.transition = 'transform 0.5s ease'; 
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach(d => d.classList.remove('active'));
            dots[index].classList.add('active');
            currentIndex = index;
        };

        if(nextBtn && prevBtn) {
            nextBtn.onclick = () => {
                let newIndex = currentIndex + 1;
                if(newIndex >= totalSlides) newIndex = 0;
                updateCarousel(newIndex);
            };
            prevBtn.onclick = () => {
                let newIndex = currentIndex - 1;
                if(newIndex < 0) newIndex = totalSlides - 1;
                updateCarousel(newIndex);
            };
        }

        const isJeux = folder && folder.includes('jeux');

        if (!isJeux) {
            track.style.cursor = 'grab';
            let startX = 0;
            let currentX = 0;
            let isDragging = false;

            const dragStart = (e) => {
                isDragging = true;
                track.style.cursor = 'grabbing';
                track.style.transition = 'none';
                startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
                currentX = startX;
            };

            const dragMove = (e) => {
                if (!isDragging) return;
                currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
                const diffX = currentX - startX;
                track.style.transform = `translateX(calc(-${currentIndex * 100}% + ${diffX}px))`;
            };

            const dragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                track.style.cursor = 'grab';
                track.style.transition = 'transform 0.5s ease'; 
                
                const diffX = startX - currentX;
                
                if (Math.abs(diffX) > 50 && startX !== currentX) {
                    if (diffX > 0) {
                        let newIndex = currentIndex + 1;
                        if(newIndex >= totalSlides) newIndex = 0;
                        updateCarousel(newIndex);
                    } else {
                        let newIndex = currentIndex - 1;
                        if(newIndex < 0) newIndex = totalSlides - 1;
                        updateCarousel(newIndex);
                    }
                } else {
                    updateCarousel(currentIndex);
                }
            };

            track.addEventListener('mousedown', dragStart);
            track.addEventListener('mousemove', dragMove);
            track.addEventListener('mouseup', dragEnd);
            track.addEventListener('mouseleave', () => { if(isDragging) dragEnd(); });
            
            track.addEventListener('touchstart', dragStart, {passive: true});
            track.addEventListener('touchmove', dragMove, {passive: true});
            track.addEventListener('touchend', dragEnd);

            track.ondragstart = () => false;
        }
    }
});
