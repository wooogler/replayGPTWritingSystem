import csv
import sys
import json
import ast

def python_to_json(python_str):
    """Convert Python-style string representation to JSON"""
    if not python_str or python_str.strip() == '':
        return python_str

    try:
        python_obj = ast.literal_eval(python_str)
        # Convert to JSON string
        return json.dumps(python_obj, ensure_ascii=False)
    except:
        # If it fails, return original
        return python_str

def fix_csv(input_file, output_file):
    print(f"Reading from: {input_file}")
    print(f"Writing to: {output_file}")

    rows_read = 0
    rows_written = 0
    conversion_errors = 0

    try:
        with open(input_file, 'r', encoding='utf-8', newline='') as infile:
            with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
                reader = csv.reader(infile, quoting=csv.QUOTE_MINIMAL, skipinitialspace=False)
                # Write with proper JSON-compatible escaping
                writer = csv.writer(outfile, quoting=csv.QUOTE_MINIMAL)

                for row in reader:
                    rows_read += 1
                    if rows_read == 1:
                        # Clean up header
                        expected_cols = ['idx', 'essay_num', 'op_index', 'time', 'op_loc', 'op_type',
                                       'current_editor', 'add', 'delete', 'selected_text',
                                       'cursor_location', 'recording_obj']
                        writer.writerow(expected_cols)
                        rows_written += 1
                        print(f"Header: {len(expected_cols)} columns")
                    else:
                        while len(row) < 12:
                            row.append('')

                        if row[6]:
                            converted = python_to_json(row[6])
                            if converted != row[6]:
                                row[6] = converted
                            elif row[6].strip():
                                conversion_errors += 1

                        if row[10]:
                            converted = python_to_json(row[10])
                            if converted != row[10]:
                                row[10] = converted

                        if row[11]:
                            converted = python_to_json(row[11])
                            if converted != row[11]:
                                row[11] = converted
                            elif row[11].strip():
                                conversion_errors += 1

                        writer.writerow(row[:12])
                        rows_written += 1

                    if rows_read % 1000 == 0:
                        print(f"Processed {rows_read} rows...")

        print(f"\nComplete! Read {rows_read} rows, wrote {rows_written} rows")
        if conversion_errors > 0:
            print(f"Warning: {conversion_errors} fields could not be converted to JSON")
        return True

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    input_file = r"c:\Users\andez\OneDrive\Documents\ComputerScience\replay_project\replay\public\data\replay_data.csv"
    output_file = r"c:\Users\andez\OneDrive\Documents\ComputerScience\replay_project\replay\public\data\replay_data_fixed.csv"

    success = fix_csv(input_file, output_file)
    sys.exit(0 if success else 1)
