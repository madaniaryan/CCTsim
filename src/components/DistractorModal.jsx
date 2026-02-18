export default function DistractorModal({ data, onAnswer, onClose }) {
  const { card, answered, selectedChoice, correct } = data;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <div className="attending-info">
            <img
              className="attending-avatar"
              src={card.attendingImage || "/assets/attending.png"}
              alt="Attending"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <div className="attending-label">Attending</div>
              <div className="attending-subtitle">Rapid question</div>
            </div>
          </div>
        </div>
        <p className="modal-question">
          <strong>Attending:</strong> {card.prompt}
        </p>
        {card.image && (!card.revealImageOnAnswer || answered) && (
          <div className="modal-image">
            <img
              src={card.image}
              alt="Reference"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="modal-options">
          {card.choices.map((choice, index) => {
            const isSelected = selectedChoice && choice.id === selectedChoice.id;
            const status = answered && isSelected ? (correct ? 'correct' : 'wrong') : '';
            return (
              <button
                key={choice.id}
                className={`option ${status}`}
                onClick={() => onAnswer(index)}
                disabled={answered}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`modal-feedback ${correct ? 'correct' : 'wrong'}`}>
            {correct ? 'Correct.' : 'Incorrect.'} {selectedChoice?.feedback}
          </div>
        )}
        {answered && (
          <button className="close" onClick={onClose}>Return to overview</button>
        )}
      </div>
    </div>
  );
}
