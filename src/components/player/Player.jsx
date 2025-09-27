/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import Hls from "hls.js";
import { useEffect, useRef, useState, useMemo } from "react";
import Artplayer from "artplayer";
import artplayerPluginChapter from "./artPlayerPluinChaper";
import autoSkip from "./autoSkip";
import artplayerPluginVttThumbnail from "./artPlayerPluginVttThumbnail";
import {
  backward10Icon,
  backwardIcon,
  captionIcon,
  forward10Icon,
  forwardIcon,
  fullScreenOffIcon,
  fullScreenOnIcon,
  loadingIcon,
  logo,
  muteIcon,
  pauseIcon,
  pipIcon,
  playIcon,
  playIconLg,
  settingsIcon,
  volumeIcon,
} from "./PlayerIcons";
import "./Player.css";
import website_name from "@/src/config/website";
import getChapterStyles from "./getChapterStyle";
import artplayerPluginHlsControl from "artplayer-plugin-hls-control";
import artplayerPluginUploadSubtitle from "./artplayerPluginUploadSubtitle";

Artplayer.LOG_VERSION = false;
Artplayer.CONTEXTMENU = false;

const KEY_CODES = {
  M: "KeyM",
  I: "KeyI",
  F: "KeyF",
  V: "KeyV",
  SPACE: "Space",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_RIGHT: "ArrowRight",
  ARROW_LEFT: "ArrowLeft",
};

const MAX_CONTINUE_WATCHING = 50;

export default function Player({
  streamUrl,
  subtitles,
  thumbnail,
  intro,
  outro,
  autoSkipIntro,
  autoPlay,
  autoNext,
  episodeId,
  episodes,
  playNext,
  animeInfo,
  episodeNum,
  streamInfo,
}) {
  const artRef = useRef(null);
  const leftAtRef = useRef(0);
  const boundKeydownRef = useRef(null);
  const logoTimeoutRef = useRef(null);
  const timeupdateHandlerRef = useRef(null);
  const hlsRef = useRef(null);

  const currentEpisodeIndexRef = useRef(null);
  const playNextRef = useRef(playNext);
  const autoNextRef = useRef(autoNext);
  const episodesRef = useRef(episodes);
  const episodeIdRef = useRef(episodeId);
  const animeInfoRef = useRef(animeInfo);
  const m3u8proxy = import.meta.env.VITE_M3U8_PROXY_URL?.split(",") || [];
  const proxy = import.meta.env.VITE_PROXY_URL;

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(
    episodes?.findIndex(
      (episode) => episode.id.match(/ep=(\d+)/)?.[1] === episodeId
    )
  );

  useEffect(() => {
    currentEpisodeIndexRef.current = currentEpisodeIndex;
  }, [currentEpisodeIndex]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    autoNextRef.current = autoNext;
  }, [autoNext]);

  useEffect(() => {
    episodesRef.current = episodes;
  }, [episodes]);

  useEffect(() => {
    episodeIdRef.current = episodeId;
  }, [episodeId]);

  useEffect(() => {
    animeInfoRef.current = animeInfo;
  }, [animeInfo]);

  useEffect(() => {
    if (episodes?.length > 0) {
      const newIndex = episodes.findIndex(
        (episode) => episode.id.match(/ep=(\d+)/)?.[1] === episodeId
      );
      setCurrentEpisodeIndex(newIndex);
    }
  }, [episodeId, episodes]);

  const chapterStyles = useMemo(() => getChapterStyles(intro, outro), [intro, outro]);

  useEffect(() => {
    const existingStyles = document.querySelectorAll("style[data-chapter-styles]");
    existingStyles.forEach((style) => style.remove());

    const styleElement = document.createElement("style");
    styleElement.setAttribute("data-chapter-styles", "true");
    styleElement.textContent = chapterStyles;
    document.head.appendChild(styleElement);

    return () => {
      try {
        styleElement.remove();
      } catch (e) {}
    };
  }, [chapterStyles, streamUrl, intro, outro]);

  const proxiedSubtitles = useMemo(() => {
    try {
      const iframeUrl = streamInfo?.streamingLink?.iframe;
      const headers = {
        referer: iframeUrl ? new URL(iframeUrl).origin + "/" : window.location.origin + "/",
      };
      return (subtitles || []).map((s) => {
        const encodedUrl = encodeURIComponent(s.file);
        const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
        return { ...s, file: `${proxy}${encodedUrl}&headers=${encodedHeaders}` };
      });
    } catch (err) {
      return (subtitles || []).map((s) => ({ ...s }));
    }
  }, [subtitles, streamInfo, proxy]);

  const pickM3u8Proxy = () => {
    if (Array.isArray(m3u8proxy) && m3u8proxy.length > 0) {
      return m3u8proxy[Math.floor(Math.random() * m3u8proxy.length)];
    }
    return proxy || "";
  };

  const playM3u8 = (video, url, art) => {
    try {
      if (timeupdateHandlerRef.current && video) {
        video.removeEventListener("timeupdate", timeupdateHandlerRef.current);
        timeupdateHandlerRef.current = null;
      }
    } catch (e) {}

    const onTimeUpdate = () => {
      const currentTime = Math.round(video.currentTime || 0);
      const duration = Math.round(video.duration || 0);
      if (duration > 0 && currentTime >= duration) {
        try {
          art.pause();
        } catch (e) {}
        const idx = currentEpisodeIndexRef.current;
        const eps = episodesRef.current;
        if (idx != null && eps && idx < eps.length - 1 && autoNextRef.current) {
          const nextEpId = eps[idx + 1].id.match(/ep=(\d+)/)?.[1];
          if (nextEpId) {
            try {
              playNextRef.current(nextEpId);
            } catch (e) {}
          }
        }
      }
    };

    timeupdateHandlerRef.current = onTimeUpdate;
    video.addEventListener("timeupdate", onTimeUpdate);

    if (Hls.isSupported()) {
      try {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      } catch (e) {}

      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      art.on("destroy", () => {
        try {
          hls.destroy();
        } catch (e) {}
        try {
          if (timeupdateHandlerRef.current && video) {
            video.removeEventListener("timeupdate", timeupdateHandlerRef.current);
            timeupdateHandlerRef.current = null;
          }
        } catch (e) {}
      });
    } else if (video.canPlayType && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      art.on("destroy", () => {
        try {
          if (timeupdateHandlerRef.current && video) {
            video.removeEventListener("timeupdate", timeupdateHandlerRef.current);
            timeupdateHandlerRef.current = null;
          }
        } catch (e) {}
      });
    } else {
      console.log("Unsupported playback format: m3u8");
    }
  };

  const handleKeydown = (event, art) => {
    const target = event.target;
    const tagName = target?.tagName?.toLowerCase();
    const isEditable = target?.isContentEditable;

    if (tagName === "input" || tagName === "textarea" || isEditable) return;

    switch (event.code) {
      case KEY_CODES.M:
        art.muted = !art.muted;
        break;
      case KEY_CODES.I:
        art.pip = !art.pip;
        break;
      case KEY_CODES.F:
        event.preventDefault();
        event.stopPropagation();
        art.fullscreen = !art.fullscreen;
        break;
      case KEY_CODES.V:
        event.preventDefault();
        event.stopPropagation();
        art.subtitle.show = !art.subtitle.show;
        break;
      case KEY_CODES.SPACE:
        event.preventDefault();
        event.stopPropagation();
        art.playing ? art.pause() : art.play();
        break;
      case KEY_CODES.ARROW_UP:
        event.preventDefault();
        event.stopPropagation();
        art.volume = Math.min(art.volume + 0.1, 1);
        break;
      case KEY_CODES.ARROW_DOWN:
        event.preventDefault();
        event.stopPropagation();
        art.volume = Math.max(art.volume - 0.1, 0);
        break;
      case KEY_CODES.ARROW_RIGHT:
        event.preventDefault();
        event.stopPropagation();
        art.currentTime = Math.min(art.currentTime + 10, art.duration);
        break;
      case KEY_CODES.ARROW_LEFT:
        event.preventDefault();
        event.stopPropagation();
        art.currentTime = Math.max(art.currentTime - 10, 0);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!streamUrl || !artRef.current) return;

    const iframeUrl = streamInfo?.streamingLink?.iframe;
    const headers = {
      referer: iframeUrl ? new URL(iframeUrl).origin + "/" : window.location.origin + "/",
    };

    const proxyPrefix = pickM3u8Proxy();

    const proxiedM3u8Url =
      (proxyPrefix || "") + encodeURIComponent(streamUrl) + "&headers=" + encodeURIComponent(JSON.stringify(headers));

    const art = new Artplayer({
      url: proxiedM3u8Url,
      container: artRef.current,
      type: "m3u8",
      autoplay: !!autoPlay,
      volume: 1,
      setting: true,
      playbackRate: true,
      pip: true,
      hotkey: false,
      fullscreen: true,
      mutex: true,
      playsInline: true,
      lock: true,
      airplay: true,
      autoOrientation: true,
      fastForward: true,
      aspectRatio: true,
      moreVideoAttr: {
        crossOrigin: "anonymous",
        preload: "none",
        playsInline: true,
      },
      plugins: [
        artplayerPluginHlsControl({
          quality: {
            setting: true,
            getName: (level) => level.height + "P",
            title: "Quality",
            auto: "Auto",
          },
        }),
        artplayerPluginUploadSubtitle(),
        artplayerPluginChapter({ chapters: createChaptersFrom(intro, outro) }),
      ],
      subtitle: {
        style: {
          color: "#fff",
          "font-weight": "400",
          left: "50%",
          transform: "translateX(-50%)",
          "margin-bottom": "2rem",
        },
        escape: false,
      },
      layers: [
        {
          name: website_name,
          html: logo,
          tooltip: website_name,
          style: {
            opacity: 1,
            position: "absolute",
            top: "5px",
            right: "5px",
            transition: "opacity 0.5s ease-out",
          },
        },
        {
          html: "",
          style: {
            position: "absolute",
            left: "50%",
            top: 0,
            width: "20%",
            height: "100%",
            transform: "translateX(-50%)",
          },
          disable: !Artplayer.utils.isMobile,
          click: () => art.toggle(),
        },
        {
          name: "rewind",
          html: "",
          style: { position: "absolute", left: 0, top: 0, width: "40%", height: "100%" },
          disable: !Artplayer.utils.isMobile,
          click: () => {
            art.controls.show = !art.controls.show;
          },
        },
        {
          name: "forward",
          html: "",
          style: { position: "absolute", right: 0, top: 0, width: "40%", height: "100%" },
          disable: !Artplayer.utils.isMobile,
          click: () => {
            art.controls.show = !art.controls.show;
          },
        },
        {
          name: "backwardIcon",
          html: backwardIcon,
          style: {
            position: "absolute",
            left: "25%",
            top: "50%",
            transform: "translate(50%,-50%)",
            opacity: 0,
            transition: "opacity 0.5s ease-in-out",
          },
          disable: !Artplayer.utils.isMobile,
        },
        {
          name: "forwardIcon",
          html: forwardIcon,
          style: {
            position: "absolute",
            right: "25%",
            top: "50%",
            transform: "translate(50%, -50%)",
            opacity: 0,
            transition: "opacity 0.5s ease-in-out",
          },
          disable: !Artplayer.utils.isMobile,
        },
      ],
      controls: [
        {
          html: backward10Icon,
          position: "right",
          tooltip: "Backward 10s",
          click: () => {
            art.currentTime = Math.max(art.currentTime - 10, 0);
          },
        },
        {
          html: forward10Icon,
          position: "right",
          tooltip: "Forward 10s",
          click: () => {
            art.currentTime = Math.min(art.currentTime + 10, art.duration);
          },
        },
      ],
      icons: {
        play: playIcon,
        pause: pauseIcon,
        setting: settingsIcon,
        volume: volumeIcon,
        pip: pipIcon,
        volumeClose: muteIcon,
        state: playIconLg,
        loading: loadingIcon,
        fullscreenOn: fullScreenOnIcon,
        fullscreenOff: fullScreenOffIcon,
      },
      customType: { m3u8: playM3u8 },
    });

    art.on("resize", () => {
      try {
        art.subtitle.style({
          fontSize: (art.width > 500 ? art.width * 0.02 : art.width * 0.03) + "px",
        });
      } catch (e) {}
    });

    art.on("ready", () => {
      try {
        const continueWatchingList = JSON.parse(localStorage.getItem("continueWatching")) || [];
        const currentEntry = continueWatchingList.find((item) => item.episodeId === episodeId);
        if (currentEntry?.leftAt) art.currentTime = currentEntry.leftAt;
      } catch (e) {}

      const onPlayerTimeupdate = () => {
        try {
          leftAtRef.current = Math.floor(art.currentTime);
        } catch (e) {}
      };

      art.on("video:timeupdate", onPlayerTimeupdate);
      art._playerTimeupdateHandler = onPlayerTimeupdate;

      try {
        if (logoTimeoutRef.current) {
          clearTimeout(logoTimeoutRef.current);
          logoTimeoutRef.current = null;
        }
        logoTimeoutRef.current = setTimeout(() => {
          try {
            art.layers[website_name].style.opacity = 0;
          } catch (e) {}
          logoTimeoutRef.current = null;
        }, 2000);
      } catch (e) {}

      const subs = (proxiedSubtitles || []).map((s) => ({ ...s }));

      const defaultSubtitle = subs?.find((sub) => sub.label && sub.label.toLowerCase() === "english");
      if (defaultSubtitle) {
        try {
          art.subtitle.switch(defaultSubtitle.file, {
            name: defaultSubtitle.label,
            default: true,
          });
        } catch (e) {}
      }

      const skipRanges = [
        ...(intro?.start != null && intro?.end != null ? [[intro.start + 1, intro.end - 1]] : []),
        ...(outro?.start != null && outro?.end != null ? [[outro.start + 1, outro.end]] : []),
      ];
      if (autoSkipIntro && skipRanges.length > 0) {
        try {
          const plugin = autoSkip(skipRanges);
          art.plugins.add(plugin);
        } catch (e) {
          console.warn("autoSkip plugin failed to add", e);
        }
      }

      const boundKeydown = (event) => handleKeydown(event, art);
      boundKeydownRef.current = boundKeydown;
      document.addEventListener("keydown", boundKeydown);

      art.on("destroy", () => {
        try {
          if (boundKeydownRef.current) {
            document.removeEventListener("keydown", boundKeydownRef.current);
            boundKeydownRef.current = null;
          }
        } catch (e) {}

        try {
          if (logoTimeoutRef.current) {
            clearTimeout(logoTimeoutRef.current);
            logoTimeoutRef.current = null;
          }
        } catch (e) {}

        try {
          if (art._playerTimeupdateHandler && art.off) {
            art.off("video:timeupdate", art._playerTimeupdateHandler);
            art._playerTimeupdateHandler = null;
          }
        } catch (e) {}

        try {
          const videoEl = art.video;
          if (timeupdateHandlerRef.current && videoEl) {
            videoEl.removeEventListener("timeupdate", timeupdateHandlerRef.current);
            timeupdateHandlerRef.current = null;
          }
        } catch (e) {}

        try {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        } catch (e) {}
      });

      if (subs?.length > 0) {
        const defaultEnglishSub =
          subs.find((sub) => sub.label.toLowerCase() === "english" && sub.default) ||
          subs.find((sub) => sub.label.toLowerCase() === "english");

        art.setting.add({
          name: "captions",
          icon: captionIcon,
          html: "Subtitle",
          tooltip: defaultEnglishSub?.label || "default",
          position: "right",
          selector: [
            {
              html: "Display",
              switch: true,
              onSwitch: (item) => {
                item.tooltip = item.switch ? "Hide" : "Show";
                art.subtitle.show = !item.switch;
                return !item.switch;
              },
            },
            ...subs.map((sub) => ({
              default: sub.label.toLowerCase() === "english" && sub === defaultEnglishSub,
              html: sub.label,
              url: sub.file,
            })),
          ],
          onSelect: (item) => {
            try {
              art.subtitle.switch(item.url, { name: item.html });
            } catch (e) {}
            return item.html;
          },
        });
      }

      if (thumbnail) {
        try {
          art.plugins.add(
            artplayerPluginVttThumbnail({
              vtt: `${proxy}${thumbnail}`,
            })
          );
        } catch (e) {}
      }

      const $rewind = art.layers["rewind"];
      const $forward = art.layers["forward"];
      if (Artplayer.utils.isMobile && $rewind) {
        art.proxy($rewind, "dblclick", () => {
          try {
            art.currentTime = Math.max(0, art.currentTime - 10);
            art.layers["backwardIcon"].style.opacity = 1;
            setTimeout(() => {
              try {
                art.layers["backwardIcon"].style.opacity = 0;
              } catch (e) {}
            }, 300);
          } catch (e) {}
        });
      }
      if (Artplayer.utils.isMobile && $forward) {
        art.proxy($forward, "dblclick", () => {
          try {
            art.currentTime = Math.max(0, art.currentTime + 10);
            art.layers["forwardIcon"].style.opacity = 1;
            setTimeout(() => {
              try {
                art.layers["forwardIcon"].style.opacity = 0;
              } catch (e) {}
            }, 300);
          } catch (e) {}
        });
      }
    });

    // ensure subtitle styling is set at start
    art.subtitle.style({
      fontSize: (art.width > 500 ? art.width * 0.02 : art.width * 0.03) + "px",
    });

    // cleanup when effect re-runs or component unmounts
    return () => {
      try {
        if (art && art.destroy) {
          art.destroy(false);
        }
      } catch (e) {}

      try {
        if (boundKeydownRef.current) {
          document.removeEventListener("keydown", boundKeydownRef.current);
          boundKeydownRef.current = null;
        }
      } catch (e) {}

      try {
        const continueWatching = JSON.parse(localStorage.getItem("continueWatching")) || [];
        const newEntry = {
          id: animeInfoRef.current?.id,
          data_id: animeInfoRef.current?.data_id,
          episodeId,
          episodeNum,
          adultContent: animeInfoRef.current?.adultContent,
          poster: animeInfoRef.current?.poster,
          title: animeInfoRef.current?.title,
          japanese_title: animeInfoRef.current?.japanese_title,
          leftAt: leftAtRef.current,
          updatedAt: Date.now(),
        };

        if (newEntry.data_id) {
          const filtered = continueWatching.filter((item) => item.data_id !== newEntry.data_id);
          filtered.unshift(newEntry);
          const limited = filtered.slice(0, MAX_CONTINUE_WATCHING);
          localStorage.setItem("continueWatching", JSON.stringify(limited));
        }
      } catch (err) {
        console.error("Failed to save continueWatching:", err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, subtitles, intro, outro]);

  function createChaptersFrom(introObj, outroObj) {
    const chapters = [];
    if (introObj && (introObj.start !== 0 || introObj.end !== 0)) {
      chapters.push({ start: introObj.start, end: introObj.end, title: "intro" });
    }
    if (outroObj && (outroObj.start !== 0 || outroObj.end !== 0)) {
      chapters.push({ start: outroObj.start, end: outroObj.end, title: "outro" });
    }
    return chapters;
  }

  return <div ref={artRef} className="w-full h-full" />;
}
