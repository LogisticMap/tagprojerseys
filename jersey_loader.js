// ==UserScript==
// @name           my jerseys
// @version        0.69420
// @description    Load team jerseys based on group abbreviations. Final version with all fixes.
// @author         Poeticalto, Hjalpa, Destar, Some Ball -1, Ko, ballparts
// @match          *://*.koalabeast.com/*
// @grant          GM_xmlhttpRequest
// @grant          GM_setValue
// @grant          GM_getValue
// @grant          unsafeWindow
// @run-at         document-idle
// @connect        raw.githubusercontent.com
// ==/UserScript==

//Yes, this is the legitimate version number. Not a meme.

const SPRITE_SIZE = 38;

(function() {
    'use strict';

    const JERSEY_JSON_URL = 'https://raw.githubusercontent.com/LogisticMap/tagprojerseys/refs/heads/main/jerseys.json';
    let jerseyLinks = {};

    // --- UTILITY FUNCTIONS ---

    function getAverageColorFromImage(url, callback) {
        const img = new Image();
        let scaleDown = false;
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            if (img.width === 0 || img.height === 0) { callback("#888888"); return; }
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            let imageData;
            try { imageData = ctx.getImageData(0, 0, img.width, img.height); }
            catch (e) { callback("#888888"); return; }
            const data = imageData.data;
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] > 0) {
                    r += data[i]; g += data[i+1]; b += data[i+2]; count++;
                }
                if (i === 4 * (img.width/2) * img.height ** data[i+3] < 20 && img.width === 40) {
                    scaleDown = true;
                }
            }
            console.log()
            if (count === 0) { callback("#888888"); return; }
            r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
            callback({color: `rgb(${r},${g},${b})`, scaleDown});
        };
        img.onerror = function() { callback("#888888"); };
        img.src = url;
    }

    function loadJerseysJSON(cb) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: JERSEY_JSON_URL,
            onload(resp) {
                try {
                    jerseyLinks = JSON.parse(resp.responseText);
                    if (cb) cb();
                } catch (e) { console.error('Failed to parse jersey JSON', e); }
            }
        });
    }

    // --- GROUP PAGE LOGIC ---

    function setupGroupPageListeners() {
        function attachListenersAndObservers() {
            const inputs = document.getElementsByTagName('input');
            const redInput = inputs.redTeamName;
            const blueInput = inputs.blueTeamName;
            if (!(redInput && blueInput)) return;

            function storeJerseyInfo() {
                const redAbr = redInput.value.trim();
                const blueAbr = blueInput.value.trim();
                const redData = jerseyLinks[redAbr];
                const blueData = jerseyLinks[blueAbr];
                GM_setValue('TP_JERSEY_RED_DATA', redData ? [redData[0], redData[2], redData[4]] : null);
                GM_setValue('TP_JERSEY_BLUE_DATA', blueData ? [blueData[1], blueData[3], blueData[5]] : null);
                GM_setValue('TP_JERSEY_RED_TEAMNAME', redAbr);
                GM_setValue('TP_JERSEY_BLUE_TEAMNAME', blueAbr);
                console.log('[Jerseys Loader] Jersey info updated:', {
                    redAbr, blueAbr, redData, blueData
                });
            }

            // Expose storeJerseyInfo for swapTeams handler
            attachListenersAndObservers.storeJerseyInfo = storeJerseyInfo;

            // Remove previous listeners/observers if any
            if (redInput._jerseyListeners) {
                redInput._jerseyListeners.forEach(l => redInput.removeEventListener(l.event, l.fn));
            }
            if (blueInput._jerseyListeners) {
                blueInput._jerseyListeners.forEach(l => blueInput.removeEventListener(l.event, l.fn));
            }
            redInput._jerseyListeners = [];
            blueInput._jerseyListeners = [];

            // Attach listeners
            const events = ['change', 'keyup'];
            events.forEach(event => {
                redInput.addEventListener(event, storeJerseyInfo);
                redInput._jerseyListeners.push({event, fn: storeJerseyInfo});
                blueInput.addEventListener(event, storeJerseyInfo);
                blueInput._jerseyListeners.push({event, fn: storeJerseyInfo});
            });

            // Attach MutationObservers
            const observerConfig = { attributes: true, childList: false, subtree: false, characterData: false };
            if (redInput._jerseyObserver) redInput._jerseyObserver.disconnect();
            if (blueInput._jerseyObserver) blueInput._jerseyObserver.disconnect();
            redInput._jerseyObserver = new MutationObserver(() => {
                storeJerseyInfo();
            });
            blueInput._jerseyObserver = new MutationObserver(() => {
                storeJerseyInfo();
            });
            redInput._jerseyObserver.observe(redInput, observerConfig);
            blueInput._jerseyObserver.observe(blueInput, observerConfig);

            // Initial update
            storeJerseyInfo();
        }

        attachListenersAndObservers();

        // Listen for swapTeams event from group socket
        if (tagpro && tagpro.group && tagpro.group.socket) {
            tagpro.group.socket.on('swapTeams', function() {
                setTimeout(function() {
                    attachListenersAndObservers();
                    // Explicitly update jersey info after swap
                    if (typeof attachListenersAndObservers.storeJerseyInfo === 'function') {
                        attachListenersAndObservers.storeJerseyInfo();
                    }
                    // Log input field values and stored jersey data for debugging
                    const inputs = document.getElementsByTagName('input');
                    const redInput = inputs.redTeamName;
                    const blueInput = inputs.blueTeamName;
                    const redAbr = redInput ? redInput.value.trim() : null;
                    const blueAbr = blueInput ? blueInput.value.trim() : null;
                    const redData = GM_getValue('TP_JERSEY_RED_DATA', null);
                    const blueData = GM_getValue('TP_JERSEY_BLUE_DATA', null);
                    const redTeamName = GM_getValue('TP_JERSEY_RED_TEAMNAME', '');
                    const blueTeamName = GM_getValue('TP_JERSEY_BLUE_TEAMNAME', '');
                    console.log('[Jerseys Loader] swapTeams event handled, listeners re-attached. Debug info:', {
                        redInputValue: redAbr,
                        blueInputValue: blueAbr,
                        storedRedData: redData,
                        storedBlueData: blueData,
                        storedRedTeamName: redTeamName,
                        storedBlueTeamName: blueTeamName
                    });
                }, 100); // Increased delay to allow DOM update
            });
            // Listen for setting event to catch team name changes
            tagpro.group.socket.on('setting', function(setting) {
                if (setting.name === 'redTeamName' || setting.name === 'blueTeamName') {
                    setTimeout(function() {
                        attachListenersAndObservers();
                        if (typeof attachListenersAndObservers.storeJerseyInfo === 'function') {
                            attachListenersAndObservers.storeJerseyInfo();
                        }
                        // Debug logging
                        const inputs = document.getElementsByTagName('input');
                        const redInput = inputs.redTeamName;
                        const blueInput = inputs.blueTeamName;
                        const redAbr = redInput ? redInput.value.trim() : null;
                        const blueAbr = blueInput ? blueInput.value.trim() : null;
                        const redData = GM_getValue('TP_JERSEY_RED_DATA', null);
                        const blueData = GM_getValue('TP_JERSEY_BLUE_DATA', null);
                        console.log('[Jerseys Loader] setting event handled, listeners re-attached. Debug info:', {
                            redInputValue: redAbr,
                            blueInputValue: blueAbr,
                            storedRedData: redData,
                            storedBlueData: blueData
                        });
                    }, 100);
                }
            });
        }
    }

    // --- GAME PAGE LOGIC ---

    function setupGameRenderer() {
        const uw = unsafeWindow;
        if (!(uw.tagpro && uw.tagpro.renderer && uw.PIXI)) return;
        const renderer = uw.tagpro.renderer;
        const origUpdate = renderer.updatePlayerSpritePosition;

        renderer.createJersey = function(player) {
            const teamData = player.team === 1 ? GM_getValue('TP_JERSEY_RED_DATA', null) : GM_getValue('TP_JERSEY_BLUE_DATA', null);
            if (!teamData) {
                if (player.sprites.jersey && player.sprites.jersey.parent) {
                    player.sprites.ball.removeChild(player.sprites.jersey);
                }
                player.sprites.jersey = new uw.PIXI.Container();
                player.sprites.jersey.team = player.team;
                player.sprites.ball.addChildAt(player.sprites.jersey, 1);
                return;
            }

            const sprite = new uw.PIXI.Sprite(uw.PIXI.Texture.from(imgUrl));
            sprite.anchor.set(0.5, 0.5);
            sprite.position.set(20, 20);
            player.sprites.actualBall.alpha = (ballAlpha >= 0 && ballAlpha <= 1) ? ballAlpha : 1;
            sprite.alpha = (jerseyAlpha >= 0 && jerseyAlpha <= 1) ? jerseyAlpha : 1;
            sprite.team = player.team;
            player.sprites.jersey = sprite;
            console.log(sprite)
            player.sprites.ball.addChildAt(sprite, 1);
            const [code, ballAlpha, jerseyAlpha] = teamData;
            const imgUrl = code.startsWith('http') ? code : `https://i.imgur.com/${code}.png`;
            uw.activeJerseyColors = uw.activeJerseyColors || {};
            if (player.team === 1 && !uw.activeJerseyColors.red) {
                getAverageColorFromImage(imgUrl, ({color, scaleDown}) => {
                    uw.activeJerseyColors.red = `rgb(255,0,0)`;
                    if (scaleDown) {
                      console.log('scaling down')
                      player.sprites.jersey.width = SPRITE_SIZE;
                      player.sprites.jersey.height = SPRITE_SIZE;
                    }
                });
            }
            if (player.team === 2 && !uw.activeJerseyColors.blue) {
                getAverageColorFromImage(imgUrl, ({color, scaleDown}) => {
                    uw.activeJerseyColors.red = `rgb(0,0,255)`;
                    if (scaleDown) {
                      player.sprites.jersey.width = SPRITE_SIZE;
                      player.sprites.jersey.height = SPRITE_SIZE;
                    }
                });
            }
            if (player.sprites.jersey && player.sprites.jersey.parent) {
                player.sprites.ball.removeChild(player.sprites.jersey);
            }
        };

        renderer.updatePlayerSpritePosition = function(player) {
            if (!player.sprites.jersey || player.sprites.jersey.team !== player.team) {
                this.createJersey(player);
            }
            const idx = player.sprites.ball.getChildIndex(player.sprites.actualBall) + 1;
            if (idx !== player.sprites.ball.getChildIndex(player.sprites.jersey)) {
                player.sprites.ball.setChildIndex(player.sprites.jersey, idx);
            }
            if (true) { player.sprites.jersey.rotation = player.angle; }
            origUpdate.call(this, player);
        };
    }

    // --- SCRIPT ENTRY POINT ---

    function main() {
        if (window.location.pathname.startsWith('/groups/')) {
            GM_setValue('TP_JERSEY_RED_DATA', null);
            GM_setValue('TP_JERSEY_BLUE_DATA', null);
            console.log("Jerseys Loader: Cleared stale jersey data and setting up listeners.");
            setupGroupPageListeners();
        }

        if (unsafeWindow.tagpro && unsafeWindow.tagpro.renderer) {
            console.log("Jerseys Loader: Game detected. Setting up renderer.");
            if (unsafeWindow.tagpro.ready) {
                unsafeWindow.tagpro.ready(setupGameRenderer);
            } else {
                window.addEventListener('load', setupGameRenderer);
            }
        }
    }

    loadJerseysJSON(main);

})();
