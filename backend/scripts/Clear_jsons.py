import json
import os

# НАСТРОЙКИ
# Имя файла
TARGET_FILE = 'data.json'


# ==========================================

def has_null(value):
    """
    Рекурсивно проверяет, содержит ли значение (или его вложенные части) null (None).
    """
    if value is None:
        return True

    if isinstance(value, dict):
        # Проверяем все значения в словаре
        return any(has_null(v) for v in value.values())

    if isinstance(value, list):
        # Проверяем все элементы в списке
        return any(has_null(v) for v in value)

    return False


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, TARGET_FILE)

    if not os.path.exists(file_path):
        print(f"Ошибка: Файл не найден по пути: {file_path}")
        return

    try:
        # Читаем файл
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Проверяем, является ли верхний уровень списком
        if not isinstance(data, list):
            print("Ошибка: Ожидается, что корневая структура JSON — это список объектов ( [] ).")
            return

        original_count = len(data)

        # ФИЛЬТРАЦИЯ: Оставляем только те объекты, где has_null вернул False
        cleaned_data = [item for item in data if not has_null(item)]

        removed_count = original_count - len(cleaned_data)

        # Формируем имя для сохранения
        # output_path = file_path
        output_path = os.path.join(script_dir, f"cleaned_{TARGET_FILE}")

        # Сохраняем результат
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=4, ensure_ascii=False)

        print(f"Готово!")
        print(f"Всего объектов было: {original_count}")
        print(f"Удалено объектов с null: {removed_count}")
        print(f"Результат сохранен в: {output_path}")

    except json.JSONDecodeError:
        print("Ошибка: Невалидный формат JSON.")
    except Exception as e:
        print(f"Произошла ошибка: {e}")


if __name__ == "__main__":
    main()