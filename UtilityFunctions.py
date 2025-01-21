from datetime import datetime
import pandas as pd

# Utility functions
def create_time_intervals(action_data_json, selected_day):
    """Create time intervals from action data."""
    time_intervals = []
    for i, value in enumerate(action_data_json):
        start_time = datetime.strptime(f"{selected_day} {int(value['Hour']):02}:{int(value['Min']):02}:00", "%Y-%m-%d %H:%M:%S")
        if i + 1 < len(action_data_json):
            next_value = action_data_json[i + 1]
            end_time = datetime.strptime(f"{selected_day} {int(next_value['Hour']):02}:{int(next_value['Min']):02}:00", "%Y-%m-%d %H:%M:%S")
        else:
            end_time = datetime.strptime(f"{selected_day} 23:59:59", "%Y-%m-%d %H:%M:%S")

        time_intervals.append({"start": start_time, "end": end_time, "action": value['Action']})
    return time_intervals

def group_split_data(df_splits, time_intervals):
    """Group split data based on time intervals."""
    grouped_data = []
    for interval in time_intervals:
        if interval["action"] in ["Free", "25"]:
            continue
        group = df_splits[(df_splits['Timestamp'] >= interval['start']) & (df_splits['Timestamp'] < interval['end'])]
        if not group.empty:
            grouped_data.append(group.to_dict(orient='records'))
    return grouped_data

def create_annotations(grouped_data, action_data_json, free_table, seq_key):
    """Create annotations for each grouped data set."""
    annotations = []
    phase_mode = action_data_json[0]['Phase_Mode']

    for i, group in enumerate(grouped_data):
        if i + 1 >= len(action_data_json):
            continue

        coord_phase = action_data_json[i + 1]['Coord_Phase']
        sequence_num = action_data_json[i + 1]['Sequence']
        sequence = seq_key[int(sequence_num) - 1]['Phase_Seq']

        seq_list = get_sequence_list(sequence, phase_mode)
        annotations.append(create_cycle_annotations(group, seq_list, free_table))

    return annotations

def get_sequence_list(sequence, phase_mode):
    """Parse sequence into lists based on mode."""
    seq_list = [int(phase) for phase in sequence.split(',')]
    if phase_mode == 'QSeq':
        return [[*seq_list[:4], *seq_list[6:]], seq_list[4:6]]
    elif phase_mode == 'STD8':
        return [seq_list[:4], seq_list[4:]]
    return [seq_list]

def create_cycle_annotations(group, seq_list, free_table):
    """Create annotations for a single cycle."""
    cycle_annotations = []
    color_map = {"Green": "Green", "Yel": "Yel", "Red": "Red", "AllRed": "AllRed"}

    for cycle in group:
        line_annotations = []

        for seq in seq_list:
            phase_annotations = []
            start_time = cycle["Timestamp"]

            for phase in seq:
                split = cycle.get(f"SP{phase}_split")
                if split is not None and split > 0:
                    annotations, start_time = calculate_phase_annotations(start_time, split, phase, free_table, color_map)
                    phase_annotations.append({f"Phase_{phase}": annotations})

            line_annotations.append(phase_annotations)

        cycle_annotations.append(line_annotations)

    return cycle_annotations

def calculate_phase_annotations(start, split, phase, free_table, color_map):
    """Calculate phase annotations for a given split."""
    yel = int(free_table["Yel"][int(phase) - 1])
    red = int(free_table["Red"][int(phase) - 1])

    green_end = start + pd.Timedelta(seconds=split - (yel + red))
    yellow_end = start + pd.Timedelta(seconds=split - red)
    red_end = start + pd.Timedelta(seconds=split)

    annotations = [
        {"start": start, "end": green_end, "color": color_map["Green"]},
        {"start": green_end, "end": yellow_end, "color": color_map["Yel"]},
        {"start": yellow_end, "end": red_end, "color": color_map["Red"]},
    ]

    return annotations, red_end
