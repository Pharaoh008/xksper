import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTypewriterOptions {
  speed?: number;
  onComplete?: () => void;
}

export function useTypewriter(options: UseTypewriterOptions = {}) {
  const { speed = 15, onComplete } = options;
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fullContentRef = useRef('');
  const animationRef = useRef<number | null>(null);

  const startTyping = useCallback((content: string) => {
    fullContentRef.current = content;
    setDisplayedContent('');
    setIsTyping(true);

    let currentIndex = 0;
    const totalLength = content.length;

    const typeNext = () => {
      if (currentIndex < totalLength) {
        const nextIndex = Math.min(currentIndex + 3, totalLength);
        setDisplayedContent(content.slice(0, nextIndex));
        currentIndex = nextIndex;
        animationRef.current = window.setTimeout(typeNext, speed);
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };

    animationRef.current = window.setTimeout(typeNext, speed);
  }, [speed, onComplete]);

  const stopTyping = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    setDisplayedContent(fullContentRef.current);
    setIsTyping(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  return {
    displayedContent,
    isTyping,
    startTyping,
    stopTyping,
  };
}
