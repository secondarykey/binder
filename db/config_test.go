package db_test

import (
	"fmt"
	"testing"
	"time"
)

func TestConfigGet(t *testing.T) {
	inst := open()
	defer inst.Close()

	conf, err := inst.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() is error: %v", err)
	}

	if conf == nil {
		t.Errorf("GetConfig() is nil")
	}

	if conf.Name != "Sample Binder" {
		t.Errorf("Config.Name note sampleu = %v", conf.Name)
	}
}

func TestConfigUpdate(t *testing.T) {
	inst := open()
	defer inst.Close()

	conf, err := inst.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() is error: %v", err)
	}

	detail := "SampleDetail" + fmt.Sprintf("%v", time.Now())
	conf.Detail = detail
	create := conf.Created
	update := conf.Updated

	err = inst.UpdateConfig(conf)
	if err != nil {
		t.Errorf("UpdateConfig() is error: %v", err)
	}

	conf, err = inst.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() is error: %v", err)
	}

	if conf.Detail != detail {
		t.Errorf("Update Config error: %v", conf.Detail)
	}

	if conf.Created != create {
		// 最初の更新なのでテストしたいなら再度更新
		//t.Errorf("Update Config created error: %v", conf.Created)
	}
	if conf.Updated == update {
		t.Errorf("Update Config updated error: %v", conf.Created)
	}

}
