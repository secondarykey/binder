package test

import (
	"log"
	"os"
)

const (
	Dir = "testing_work"
)

func Clean() {
	defer os.Mkdir(Dir, 0666)
	_, err := os.Stat(Dir)
	if err != nil {
		return
	}

	remove(Dir)
}

func remove(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Println(err)
		return
	}

	for _, entry := range entries {

		i, err := entry.Info()
		if err != nil {
			log.Println(err)
			return
		}

		n := dir + "/" + i.Name()

		if i.IsDir() {
			remove(n)
		}

		os.Remove(n)
	}
}
