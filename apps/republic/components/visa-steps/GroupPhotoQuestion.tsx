import { GROUP_PHOTO_QUESTION } from '@/lib/content'

export function GroupPhotoQuestion({ onAnswer }: { onAnswer: (answer: string) => void }) {
  return (
    <div className="animate-fade-in">
      <p className="text-center font-stamp text-base uppercase tracking-wide text-navy">
        {GROUP_PHOTO_QUESTION.question}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {GROUP_PHOTO_QUESTION.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onAnswer(option)}
            className="min-h-11 border-2 border-navy bg-paper px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-colors hover:bg-navy hover:text-paper"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
