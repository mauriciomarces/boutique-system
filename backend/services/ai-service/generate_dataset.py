from app.dataset import write_datasets


def main() -> None:
    manifest = write_datasets()
    print("Dataset generado")
    print(f"  filas: {manifest['n_rows']}")
    print(f"  NORMAL: {manifest['n_normal']}")
    print(f"  ANOMALO: {manifest['n_anomalo']}")
    print(f"  balanced: {manifest['balanced_path']}")
    print(f"  imbalanced: {manifest['imbalanced_path']}")


if __name__ == "__main__":
    main()
