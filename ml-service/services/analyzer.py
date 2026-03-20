from collections import defaultdict
import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression


def _build_topic_stats(attempts):
    stats = defaultdict(lambda: {'attempts': 0, 'correct': 0, 'time_sum': 0.0})

    for attempt in attempts:
        subject = attempt.get('subject', 'Unknown')
        topic = attempt.get('topic', 'Unknown')
        key = (subject, topic)
        stats[key]['attempts'] += 1
        stats[key]['correct'] += 1 if attempt.get('isCorrect') else 0
        stats[key]['time_sum'] += float(attempt.get('timeTakenSec', 0) or 0)

    rows = []
    for (subject, topic), row in stats.items():
        attempts_count = row['attempts']
        accuracy = (row['correct'] / attempts_count) * 100 if attempts_count else 0
        avg_time = row['time_sum'] / attempts_count if attempts_count else 0
        weakness_score = (100 - accuracy) + min(avg_time, 180) * 0.2
        rows.append(
            {
                'subject': subject,
                'topic': topic,
                'attempts': attempts_count,
                'accuracy': accuracy,
                'avgTimeTakenSec': avg_time,
                'weaknessScore': weakness_score,
            }
        )

    rows.sort(key=lambda item: item['weaknessScore'], reverse=True)
    return rows


def _train_prob_model(attempts):
    if len(attempts) < 15:
        return None, None

    feature_rows = []
    y = []

    for attempt in attempts:
        feature_rows.append(
            {
                'subject': attempt.get('subject', 'Unknown'),
                'topic': attempt.get('topic', 'Unknown'),
                'timeTakenBucket': int((attempt.get('timeTakenSec') or 0) // 20),
            }
        )
        y.append(1 if attempt.get('isCorrect') else 0)

    # If labels are one-class, logistic regression cannot be trained.
    if len(set(y)) < 2:
        return None, None

    vectorizer = DictVectorizer(sparse=False)
    X = vectorizer.fit_transform(feature_rows)

    model = LogisticRegression(max_iter=300)
    model.fit(X, np.array(y))

    return model, vectorizer


def analyze_attempts(attempts):
    if not attempts:
        return {
            'source': 'ml-service',
            'weakTopics': [],
            'recommendedQuestionIds': [],
            'topicRanking': [],
            'confidence': 0.0,
        }

    topic_rows = _build_topic_stats(attempts)
    weak_topics = [f"{row['subject']} - {row['topic']}" for row in topic_rows[:5]]

    model, vectorizer = _train_prob_model(attempts)

    confidence = 0.65
    if model is not None and vectorizer is not None:
        confidence = 0.8

    return {
        'source': 'ml-service',
        'weakTopics': weak_topics,
        'recommendedQuestionIds': [],
        'topicRanking': topic_rows[:8],
        'confidence': confidence,
    }
