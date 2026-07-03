import React, { useState, useEffect } from 'react'
import { useSpacedRepetitionStore } from '../stores/spacedRepetitionStore'
import { useModalStore } from '../stores/modalStore'
import { X, CheckCircle, Sparkles, BookOpen, AlertCircle, ArrowRight } from 'lucide-react'

export default function FlashcardsReview(): React.JSX.Element {
  const { dueCards, loadDueCards, submitReview, isLoading } = useSpacedRepetitionStore()
  const { closeModal } = useModalStore()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    loadDueCards()
  }, [])

  const currentCard = dueCards[currentIndex]

  const handleRate = async (grade: number) => {
    if (!currentCard) return

    // Submit review via SM-2
    await submitReview(currentCard.id, grade)

    // Reset flip state and update index
    setIsFlipped(false)

    // If we finished the last card or cards list shrunk
    if (currentIndex >= dueCards.length - 1) {
      setCurrentIndex(0)
    }
  }

  const handleNext = () => {
    setIsFlipped(false)
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCurrentIndex(0)
    }
  }

  // Grade labels and colors
  const gradeButtons = [
    { value: 0, label: 'Forgot', desc: 'Complete blackout', color: '#ef4444' },
    { value: 1, label: 'Incorrect', desc: 'Wrong answer', color: '#f97316' },
    { value: 2, label: 'Hard', desc: 'Very slow recall', color: '#eab308' },
    { value: 3, label: 'Good', desc: 'Correct with effort', color: '#3b82f6' },
    { value: 4, label: 'Easy', desc: 'Quick & correct', color: '#10b981' },
    { value: 5, label: 'Perfect', desc: 'No effort required', color: '#06b6d4' }
  ]

  return (
    <div className="modal-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999]">
      <div
        className="modal-content glass flex flex-col w-full max-w-xl p-6 rounded-2xl border border-white/10 shadow-2xl relative text-white"
        style={{
          background:
            'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookOpen className="text-secondary w-5 h-5 animate-pulse" />
            <h3 className="font-semibold text-lg tracking-wide">Spaced Repetition Review</h3>
          </div>
          <button
            className="btn-ghost p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => closeModal('spacedRepetition' as any)}
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading && dueCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-400">Loading your flashcards...</p>
          </div>
        ) : dueCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
            <div className="p-4 rounded-full bg-success/15 border border-success/30 text-success">
              <CheckCircle className="w-12 h-12" />
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-1">All Caught Up!</h4>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                No due flashcards left for review. Great job maintaining your knowledge maturation.
              </p>
            </div>
            <button
              className="btn btn-primary mt-2 px-6"
              onClick={() => closeModal('spacedRepetition' as any)}
            >
              Back to Workspace
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Progress indicator */}
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>
                CARD {currentIndex + 1} OF {dueCards.length}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-secondary" /> Due Reviews Active
              </span>
            </div>

            {/* Flashcard container with flip interaction */}
            <div
              className="relative w-full min-h-[220px] rounded-xl border border-white/10 cursor-pointer select-none transition-all duration-300 shadow-lg"
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                perspective: 1000,
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div
                className="absolute inset-0 w-full h-full flex flex-col justify-center items-center p-8 text-center transition-all duration-500"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  opacity: isFlipped ? 0 : 1,
                  pointerEvents: isFlipped ? 'none' : 'auto'
                }}
              >
                <span className="text-xs tracking-wider text-secondary uppercase mb-2">Front</span>
                <p className="text-lg font-medium leading-relaxed">{currentCard?.front}</p>
                <span className="text-xs text-gray-500 mt-6 flex items-center gap-1">
                  Click card to reveal answer <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div
                className="absolute inset-0 w-full h-full flex flex-col justify-center items-center p-8 text-center transition-all duration-500"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
                  opacity: isFlipped ? 1 : 0,
                  pointerEvents: isFlipped ? 'auto' : 'none'
                }}
              >
                <span className="text-xs tracking-wider text-accent uppercase mb-2">
                  Back / Answer
                </span>
                <p className="text-lg font-medium leading-relaxed">{currentCard?.back}</p>
                <span className="text-xs text-gray-500 mt-6">
                  Click card to view front side again
                </span>
              </div>
            </div>

            {/* Grade options / Next review triggers */}
            <div className="flex flex-col gap-3 pt-2">
              {!isFlipped ? (
                <button
                  className="btn btn-primary w-full py-3 text-sm font-semibold rounded-xl"
                  onClick={() => setIsFlipped(true)}
                >
                  Reveal Answer
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-xs text-center text-gray-400 font-medium mb-1">
                    Rate your recall quality to schedule next review (SM-2):
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {gradeButtons.map((btn) => (
                      <button
                        key={btn.value}
                        type="button"
                        className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all text-center group cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRate(btn.value)
                        }}
                      >
                        <span
                          className="text-lg font-bold mb-0.5 group-hover:scale-110 transition-transform"
                          style={{ color: btn.color }}
                        >
                          {btn.value}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-200">{btn.label}</span>
                        <span className="text-[8px] text-gray-500 hidden md:block leading-tight mt-0.5">
                          {btn.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* General links */}
            <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> 0-2 reset interval, 3-5 increase maturity
              </span>
              {dueCards.length > 1 && (
                <button className="hover:text-white transition-colors" onClick={handleNext}>
                  Skip Card
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
