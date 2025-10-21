from final_convert import process_csv_to_can
from mock_data import start_mock
input_csv_file_path = '/Users/cgl/codes/zheng-related/usb-can-tauri/python-test/driving_data.csv'
output_csv_file_path = '/Users/cgl/codes/zheng-related/usb-can-tauri/public/data/sample-trajectory.csv'


def main():
    start_mock(input_csv_file_path)
    process_csv_to_can(input_csv_file_path, output_csv_file_path)

if __name__ == "__main__":
    main()