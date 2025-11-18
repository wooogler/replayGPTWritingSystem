import csv
import json

def test_all_participants():
    """Test all participants and identify those with problems"""

    participants_data = {}

    with open('public/data/replay_data_fixed.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            essay_num = int(row['essay_num'])

            # Initialize participant data
            if essay_num not in participants_data:
                participants_data[essay_num] = {
                    'editor_count': 0,
                    'problem_count': 0,
                    'empty_recording': 0,
                    'json_parse_error': 0,
                    'missing_fields': 0,
                    'sample_problems': []
                }

            if row['op_loc'] == 'editor':
                participants_data[essay_num]['editor_count'] += 1
                rec_obj = row['recording_obj']

                if not rec_obj:
                    participants_data[essay_num]['problem_count'] += 1
                    participants_data[essay_num]['empty_recording'] += 1
                    if len(participants_data[essay_num]['sample_problems']) < 2:
                        participants_data[essay_num]['sample_problems'].append({
                            'idx': row['idx'],
                            'type': 'empty_recording',
                            'time': row['time']
                        })
                    continue

                # Try to parse it using the JavaScript logic
                try:
                    record = rec_obj

                    # Simulate JavaScript replace logic
                    record = record.replace("{'", '{"')
                    record = record.replace("':", '":')
                    record = record.replace(", '", ', "')
                    record = record.replace("['", '["')
                    record = record.replace("'}", '"}')
                    record = record.replace("']", '"]')
                    record = record.replace("',", '",')
                    record = record.replace(": '", ': "')

                    # Try to parse as JSON
                    parsed = json.loads(record)

                    # Check if it has required fields
                    if 't' not in parsed or 'o' not in parsed:
                        participants_data[essay_num]['problem_count'] += 1
                        participants_data[essay_num]['missing_fields'] += 1
                        if len(participants_data[essay_num]['sample_problems']) < 2:
                            participants_data[essay_num]['sample_problems'].append({
                                'idx': row['idx'],
                                'type': 'missing_fields',
                                'time': row['time'],
                                'preview': rec_obj[:80]
                            })

                except json.JSONDecodeError as e:
                    participants_data[essay_num]['problem_count'] += 1
                    participants_data[essay_num]['json_parse_error'] += 1
                    if len(participants_data[essay_num]['sample_problems']) < 2:
                        participants_data[essay_num]['sample_problems'].append({
                            'idx': row['idx'],
                            'type': 'json_parse_error',
                            'error': str(e)[:60],
                            'time': row['time'],
                            'preview': rec_obj[:80]
                        })

    # Find problematic participants
    problematic = []
    low_data = []

    for essay_num in sorted(participants_data.keys()):
        data = participants_data[essay_num]

        if data['problem_count'] > 0:
            problematic.append((essay_num, data))

        if data['editor_count'] < 5:
            low_data.append((essay_num, data))

    print("="*80)
    print("PARTICIPANTS WITH JSON PARSING ERRORS")
    print("="*80)
    print(f"\nFound {len(problematic)} participants with JSON parsing issues:\n")

    for essay_num, data in problematic:
        print(f"ID {essay_num} (Participant {essay_num + 1}):")
        print(f"  Editor ops: {data['editor_count']}")
        print(f"  Problems: {data['problem_count']}")
        print(f"    - Empty recording_obj: {data['empty_recording']}")
        print(f"    - JSON parse errors: {data['json_parse_error']}")
        print(f"    - Missing fields: {data['missing_fields']}")

        if data['sample_problems']:
            print(f"  Sample problem:")
            prob = data['sample_problems'][0]
            print(f"    Type: {prob['type']}")
            if 'preview' in prob:
                print(f"    Preview: {prob['preview']}")
            if 'error' in prob:
                print(f"    Error: {prob['error']}")
        print()

    print("\n" + "="*80)
    print("PARTICIPANTS WITH INSUFFICIENT DATA (< 5 editor operations)")
    print("="*80)
    print(f"\nFound {len(low_data)} participants with insufficient data:\n")

    for essay_num, data in low_data:
        print(f"ID {essay_num} (Participant {essay_num + 1}): {data['editor_count']} editor operations")

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total participants analyzed: {len(participants_data)}")
    print(f"Participants with JSON errors: {len(problematic)}")
    print(f"Participants with insufficient data: {len(low_data)}")

    # Create lists for easy reference
    json_error_ids = [p[0] for p in problematic]
    low_data_ids = [p[0] for p in low_data]

    print(f"\nJSON Error IDs: {json_error_ids}")
    print(f"\nLow Data IDs: {low_data_ids}")

if __name__ == "__main__":
    test_all_participants()
