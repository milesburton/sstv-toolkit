import { examples, loadExample } from '../examples';
import './ExampleSelector.css';

export default function ExampleSelector({ mode, onSelectExample }) {
  const exampleList = mode === 'encode' ? examples.images : examples.audio;

  const handleSelect = async (path) => {
    try {
      const file = await loadExample(path);
      onSelectExample(file);
    } catch (error) {
      console.error('Failed to load example:', error);
    }
  };

  if (!exampleList || exampleList.length === 0) {
    return null;
  }

  return (
    <div className="example-selector">
      <h3>Try an Example</h3>
      <div className="example-list">
        {exampleList.map((example, index) => (
          <button
            key={index}
            type="button"
            className="example-item"
            onClick={() => handleSelect(example.path)}
          >
            {example.preview && (
              <img src={example.preview} alt={example.name} className="example-preview" />
            )}
            <div className="example-info">
              <strong>{example.name}</strong>
              <p>{example.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
