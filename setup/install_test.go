package setup_test

import (
	"binder/setup"
	"binder/test"
	"os"
	"path/filepath"
	"testing"
)

func TestInstall(t *testing.T) {

	dir := filepath.Join(test.Dir, "create")
	err := setup.Install(dir, test.LatestVersion, "simple")
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	files := []string{
		filepath.Join(dir, "binder.json"),
		filepath.Join(dir, "templates"),
		filepath.Join(dir, "notes"),
		filepath.Join(dir, "diagrams"),
		filepath.Join(dir, "assets"),
		filepath.Join(dir, "db"),
		filepath.Join(dir, "db", "templates.csv"),
		filepath.Join(dir, "db", "notes.csv"),
		filepath.Join(dir, "db", "diagrams.csv"),
		filepath.Join(dir, "db", "assets.csv"),
		filepath.Join(dir, "db", "structures.csv"),
	}

	//データベース確認
	for _, f := range files {
		_, err = os.Stat(f)
		if err != nil {
			t.Errorf("not exists file[%s]", f)
		}
	}

	// config.csvが存在しないことを確認
	configCSV := filepath.Join(dir, "db", "config.csv")
	if _, err = os.Stat(configCSV); err == nil {
		t.Errorf("config.csv should not exist in 0.4.5+")
	}
}
